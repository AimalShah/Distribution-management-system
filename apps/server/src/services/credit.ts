import prisma from "@dms/db";
import { fromPaise, toMoneyNumber, toPaise } from "@dms/shared";
import { serverCache, buildCacheKey } from "../utils/cache";

/**
 * The "Credit" section: one read that answers, per customer,
 *
 * - **Balance due** — what the customer still owes us, defined the same way the
 *   credit-limit check (ADR 0005) defines it: unpaid invoices minus the return
 *   credits they have not yet spent minus payments sitting unallocated on the
 *   customer's account.
 * - **Overdue** — the slice of that balance whose sale is past its due date
 *   (ADR 0009), also net of the same credits so the two figures cannot disagree
 *   about where the customer's money went.
 * - **Store credit** — what we owe the customer from SALE returns that has not
 *   been consumed by a Store Credit payment, the same definition the payment
 *   flow enforces (`INSUFFICIENT_STORE_CREDIT`).
 */
export async function getCreditOverview(organizationId: string) {
  const cacheKey = buildCacheKey("credit", organizationId, "overview");

  return serverCache.getOrSet(cacheKey, 30_000, async () => {
    const [sales, returnRows, unallocatedRows, storeCreditRows, customers] =
      await Promise.all([
        prisma.sale.findMany({
          where: {
            organizationId,
            deletedAt: null,
            status: { not: "Cancelled" },
          },
          select: {
            customerId: true,
            totalAmount: true,
            amountPaid: true,
            dueDate: true,
          },
        }),
        prisma.return.findMany({
          where: {
            organizationId,
            deletedAt: null,
            returnType: "SALE",
            sale: { deletedAt: null, status: { not: "Cancelled" } },
          },
          select: {
            sale: { select: { customerId: true } },
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                taxAmount: true,
                discount: true,
              },
            },
          },
        }),
        prisma.payment.groupBy({
          by: ["customerId"],
          where: { organizationId, saleId: null, deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.payment.groupBy({
          by: ["customerId"],
          where: { organizationId, method: "Store Credit", deletedAt: null },
          _sum: { amount: true },
        }),
        prisma.customer.findMany({
          where: { organizationId, isActive: true },
          select: {
            id: true,
            name: true,
            customerCode: true,
            creditLimit: true,
          },
          orderBy: { name: "asc" },
        }),
      ]);

    const now = Date.now();

    // Per-customer running totals, all in whole money units; store credit math
    // keeps paise precision to match the payment flow's own guard.
    type Row = {
      customerId: string;
      unpaid: number;
      overdueUnpaid: number;
      returnCreditPaise: bigint;
      unallocated: number;
      storeCreditUsedPaise: bigint;
      oldestOverdueAt: Date | null;
    };

    const rows = new Map<string, Row>();

    const rowFor = (customerId: string): Row => {
      let row = rows.get(customerId);

      if (!row) {
        row = {
          customerId,
          unpaid: 0,
          overdueUnpaid: 0,
          returnCreditPaise: 0n,
          unallocated: 0,
          storeCreditUsedPaise: 0n,
          oldestOverdueAt: null,
        };
        rows.set(customerId, row);
      }

      return row;
    };

    for (const sale of sales) {
      const row = rowFor(sale.customerId);
      const remaining = toMoneyNumber(sale.totalAmount) - toMoneyNumber(sale.amountPaid ?? 0);

      if (remaining <= 0.005) continue;

      row.unpaid += remaining;

      if (!sale.dueDate || sale.dueDate.getTime() < now) {
        row.overdueUnpaid += remaining;

        if (sale.dueDate && (!row.oldestOverdueAt || sale.dueDate < row.oldestOverdueAt)) {
          row.oldestOverdueAt = sale.dueDate;
        }
      }
    }

    for (const ret of returnRows) {
      if (!ret.sale) continue;

      rowFor(ret.sale.customerId).returnCreditPaise += ret.items.reduce(
        (sum, item) =>
          sum +
          BigInt(item.quantity) * toPaise(item.unitPrice) +
          toPaise(item.taxAmount) -
          toPaise(item.discount),
        0n
      );
    }

    for (const entry of unallocatedRows) {
      rowFor(entry.customerId).unallocated = toMoneyNumber(entry._sum.amount ?? 0);
    }

    for (const entry of storeCreditRows) {
      rowFor(entry.customerId).storeCreditUsedPaise = toPaise(entry._sum.amount ?? 0);
    }

    // The offsets (return credits, unallocated payments) belong to the balance
    // as a whole, so they are applied to the overdue part first — a customer
    // whose only unpaid invoices are overdue stays overdue to zero, not to a
    // positive remainder of an already-settled debt.
    const customerRows = customers.map((customer) => {
      const row = rows.get(customer.id);

      const unpaid = row?.unpaid ?? 0;
      const overdueUnpaid = row?.overdueUnpaid ?? 0;
      const returnCredit = Number(fromPaise(row?.returnCreditPaise ?? 0n));
      const unallocated = row?.unallocated ?? 0;
      const offsets = returnCredit + unallocated;

      const balanceDue = Math.max(0, Math.round((unpaid - offsets) * 100) / 100);
      const overdueRaw = Math.max(0, Math.round((overdueUnpaid - offsets) * 100) / 100);
      const overdue = Math.min(overdueRaw, balanceDue);
      const storeCreditPaise = (row?.returnCreditPaise ?? 0n) - (row?.storeCreditUsedPaise ?? 0n);
      const storeCredit = storeCreditPaise > 0n ? Number(fromPaise(storeCreditPaise)) : 0;

      return {
        customerId: customer.id,
        name: customer.name,
        customerCode: customer.customerCode,
        creditLimit: toMoneyNumber(customer.creditLimit ?? 0),
        balanceDue,
        overdue,
        oldestOverdueAt: overdue > 0 ? (row?.oldestOverdueAt ?? null) : null,
        storeCredit,
      };
    });

    const round2 = (v: number) => Math.round(v * 100) / 100;

    const summary = {
      balanceDue: round2(customerRows.reduce((sum, c) => sum + c.balanceDue, 0)),
      overdue: round2(customerRows.reduce((sum, c) => sum + c.overdue, 0)),
      totalStoreCredit: round2(customerRows.reduce((sum, c) => sum + c.storeCredit, 0)),
      overLimitCount: customerRows.filter(
        (c) => c.creditLimit > 0 && c.balanceDue >= c.creditLimit
      ).length,
    };

    return {
      asOfDate: new Date().toISOString(),
      summary,
      customers: customerRows,
    };
  });
}
