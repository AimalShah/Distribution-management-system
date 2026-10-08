import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { PaymentCreateInput, PaymentListQuery } from "@dms/shared";
import { badRequest, conflict, notFound } from "../http/errors";

const listInclude = {
  customer: { select: { id: true, customerCode: true, name: true, phone: true } },
  sale: { select: { id: true, saleCode: true, totalAmount: true, amountPaid: true, status: true } },
  user: { select: { name: true, email: true } },
} satisfies Prisma.PaymentInclude;

export async function getPayments({
  organizationId,
  page,
  pageSize,
  customerId,
  saleId,
  deleted,
}: PaymentListQuery & { organizationId: string }) {
  const where: Prisma.PaymentWhereInput = {
    organizationId,
    deletedAt: deleted ? { not: null } : null,
  };

  if (customerId) {
    where.customerId = customerId;
  }

  if (saleId) {
    where.saleId = saleId;
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: listInclude,
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

export async function getPaymentById(id: string, organizationId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id, organizationId },
    include: listInclude,
  });

  if (!payment) {
    throw notFound("Payment not found", "PAYMENT_NOT_FOUND");
  }

  return payment;
}

/**
 * Record money received from a customer.
 *
 * With a `saleId` the payment settles that invoice and `Sale.amountPaid` moves
 * in the same transaction. The over-payment guard is a conditional update —
 * `amountPaid <= totalAmount - amount` evaluated by the database against the row
 * it is updating — so two concurrent payments that each fit the balance they
 * read cannot both land: the second re-evaluates against the first's write and
 * matches no row. A read-then-write check would let both through. The
 * threshold is the invoice total, never the remaining balance: subtracting
 * `amount` from a snapshot of `remaining` would double-subtract what is
 * already paid and lock a partially paid invoice out of its own balance.
 *
 * Without a `saleId` the money sits on the customer's account as cash on
 * account, which the ledger shows as a receipt without touching any invoice.
 */
export async function createPayment(
  data: PaymentCreateInput,
  organizationId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: data.customerId, organizationId },
      select: { id: true },
    });

    if (!customer) {
      throw badRequest(
        "The customer does not exist in this organization",
        "CUSTOMER_NOT_IN_ORGANIZATION",
        { customerId: data.customerId }
      );
    }

    if (data.saleId) {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, organizationId },
        select: {
          id: true,
          saleCode: true,
          customerId: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          deletedAt: true,
        },
      });

      if (!sale) {
        throw badRequest(
          "The invoice does not exist in this organization",
          "SALE_NOT_IN_ORGANIZATION",
          { saleId: data.saleId }
        );
      }

      if (sale.deletedAt) {
        throw conflict(
          "That invoice has been deleted, so no payment can be recorded against it",
          "SALE_DELETED",
          { saleCode: sale.saleCode }
        );
      }

      if (sale.status === "Cancelled") {
        throw conflict(
          "That invoice is cancelled, so no payment can be recorded against it",
          "SALE_CANCELLED",
          { saleCode: sale.saleCode }
        );
      }

      if (sale.customerId !== data.customerId) {
        throw badRequest(
          "That invoice belongs to a different customer",
          "SALE_CUSTOMER_MISMATCH",
          { saleId: sale.id, customerId: data.customerId }
        );
      }

      const remaining = sale.totalAmount - sale.amountPaid;

      const claimed = await tx.sale.updateMany({
        where: {
          id: sale.id,
          organizationId,
          deletedAt: null,
          amountPaid: { lte: sale.totalAmount - data.amount },
        },
        data: { amountPaid: { increment: data.amount } },
      });

      if (claimed.count === 0) {
        throw conflict(
          "That payment would take the invoice past its total",
          "PAYMENT_EXCEEDS_BALANCE",
          { saleCode: sale.saleCode, remaining, requested: data.amount }
        );
      }
    }

    return tx.payment.create({
      data: {
        paymentCode: data.paymentCode,
        organizationId,
        customerId: data.customerId,
        saleId: data.saleId ?? null,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        note: data.note,
        paidAt: data.paidAt ?? new Date(),
        userId,
      },
      include: listInclude,
    });
  });
}

/**
 * Correct a payment by soft-deleting it — never by removing the row.
 *
 * A payment that vanished would leave the ledger unable to reconcile against
 * what actually happened at the counter. Stamping it takes its amount back off
 * the invoice it settled (guarded, so the balance cannot go negative), and the
 * correction itself stays visible.
 */
export async function deletePayment(id: string, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        paymentCode: true,
        saleId: true,
        amount: true,
        deletedAt: true,
      },
    });

    if (!existing) {
      throw notFound("Payment not found", "PAYMENT_NOT_FOUND");
    }

    if (existing.deletedAt) {
      throw conflict("This payment has already been corrected", "PAYMENT_ALREADY_DELETED", {
        paymentCode: existing.paymentCode,
      });
    }

    if (existing.saleId) {
      const claimed = await tx.sale.updateMany({
        where: {
          id: existing.saleId,
          organizationId,
          amountPaid: { gte: existing.amount },
        },
        data: { amountPaid: { decrement: existing.amount } },
      });

      if (claimed.count === 0) {
        throw conflict(
          "The invoice this payment settled no longer carries that balance, so " +
            "the correction was refused",
          "PAYMENT_BALANCE_UNDERFLOW",
          { paymentCode: existing.paymentCode, amount: existing.amount }
        );
      }
    }

    return tx.payment.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
      include: listInclude,
    });
  });
}
