import prisma from "@dms/db";
import type { Prisma } from "@dms/db";
import type { CustomerInput, CustomerLedgerQuery, CustomerUpdateInput } from "@dms/shared";
import { conflict, notFound } from "../http";

// The legacy `getCustomers` embedded every sale a customer had in each list row.
// That collection is unbounded, so it becomes a count here and the history
// itself stays on `GET /api/sales/customer/:customerId`, which is paginated.
// The count is over active invoices only: a soft-deleted invoice is out of
// circulation, and a badge that still counted it would disagree with the
// history the row links to.
const customerInclude = {
  _count: { select: { sale: { where: { deletedAt: null } } } },
} satisfies Prisma.CustomerInclude;

export type CustomerListArgs = {
  organizationId: string;
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
};

export async function getCustomers({
  organizationId,
  page,
  pageSize,
  search,
  isActive,
}: CustomerListArgs) {
  const where: Prisma.CustomerWhereInput = {
    organizationId,
    // Absent means "both", so a list can show archived customers without a
    // second request.
    ...(isActive === undefined ? {} : { isActive }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { customerCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, pageCount: Math.ceil(total / pageSize), total };
}

// The legacy `getCustomerById` used `findUnique({ where: { id } })`, so any
// authenticated member could read another tenant's customer by id. Scoped here.
export async function getCustomerById(id: string, organizationId: string) {
  return prisma.customer.findFirst({
    where: { id, organizationId },
    include: customerInclude,
  });
}

export async function addCustomer(data: CustomerInput, organizationId: string) {
  return prisma.customer.create({
    // The schema already resolved every optional field to a value or null, so
    // there is nothing left to default here.
    data: { ...data, organizationId },
    include: customerInclude,
  });
}

// The legacy `updateCustomer` called `update({ where: { id } })` with no
// organization, so any member could rewrite another tenant's customer. It also
// copied `creditLimit` straight through without the `Number()` the create path
// used, storing the raw string into a `Float` column.
export async function updateCustomer(
  id: string,
  data: CustomerUpdateInput,
  organizationId: string
) {
  return prisma.customer.update({
    where: { id, organizationId },
    // Fields absent from the body stay `undefined` and are left untouched; fields
    // the client blanked arrived as `null` and are cleared.
    data,
    include: customerInclude,
  });
}

export async function removeCustomer(id: string, organizationId: string) {
  // The legacy `deleteCustomer` also took no organization, so any member could
  // delete another tenant's customer.
  //
  // `Sale.customerId` is a plain foreign key, so a customer with sales history
  // cannot be deleted at all: the database rejects the row with `P2003`, which
  // the central mapping renders as "a referenced record does not exist or
  // belongs to another organization" — a message that describes neither cause.
  //
  // This check is for the error the caller reads, not for integrity: the
  // database is still what stops the delete, so a sale created between the count
  // and the delete falls back to that worse message. Wrapping both in a
  // transaction would close the window at the cost of holding one open for a
  // precondition, which is not worth it here.
  const saleCount = await prisma.sale.count({
    where: { customerId: id, organizationId },
  });

  if (saleCount > 0) {
    throw conflict(
      "This customer has sales history and cannot be deleted. Set isActive to false instead.",
      "CUSTOMER_HAS_SALES",
      { saleCount }
    );
  }

  // The `payments.customerId` foreign key is RESTRICT, so the database would
  // refuse this anyway — but with a message about a missing record rather than
  // about the money still on the account.
  const paymentCount = await prisma.payment.count({
    where: { customerId: id, organizationId },
  });

  if (paymentCount > 0) {
    throw conflict(
      "This customer has payments on record and cannot be deleted. Set isActive " +
        "to false instead.",
      "CUSTOMER_HAS_PAYMENTS",
      { paymentCount }
    );
  }

  await prisma.customer.delete({ where: { id, organizationId } });
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                      */
/* -------------------------------------------------------------------------- */

/** One line of a customer statement. */
export interface LedgerEntry {
  date: string;
  type: "invoice" | "credit" | "payment";
  reference: string;
  description: string;
  /** What the customer owes more because of this line. */
  debit: number;
  /** What the customer owes less because of this line. */
  credit: number;
  /** What the customer owes after this line, in chronological order. */
  balance: number;
}

export interface CustomerLedger {
  customer: { id: string; customerCode: string; name: string; phone: string | null };
  from: string | null;
  to: string | null;
  openingBalance: number;
  entries: LedgerEntry[];
  totals: {
    invoices: number;
    credits: number;
    payments: number;
    /** openingBalance + invoices - credits - payments over the window. */
    closingBalance: number;
  };
}

/**
 * A `to` bound is inclusive of its whole calendar day: a statement "as of
 * 6 October" has to include the invoices and receipts of the 6th, and a date
 * that arrives as UTC midnight would otherwise cut the day off at 00:00.
 * A bound with a time of day already is taken at face value.
 */
const upperExclusive = (to: Date): Date =>
  to.getTime() % 86_400_000 === 0
    ? new Date(to.getTime() + 86_400_000)
    : new Date(to.getTime() + 1);

/**
 * The customer's account: invoices, returns as credit entries, payments.
 *
 * The ledger is *derived*, never stored — there is no `LedgerEntry` table to
 * drift out of sync with the documents it summarises. Every balance on a
 * statement is recomputed from the live rows at read time:
 *
 * - **Invoices** debit: active (not cancelled, not soft-deleted) sales.
 * - **Returns** credit: SALE-type returns, the customer handing goods back.
 *   Write-offs (EXPIRED/DAMAGED) and purchase returns are not this customer's
 *   money and never appear.
 * - **Payments** credit: money received, allocated or on account, minus any
 *   correction.
 *
 * The opening balance covers everything *before* the window, so a period
 * statement still reconciles against the running balance the customer saw last
 * month.
 */
export async function getCustomerLedger({
  customerId,
  organizationId,
  from,
  to,
}: CustomerLedgerQuery & { customerId: string; organizationId: string }): Promise<CustomerLedger> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true, customerCode: true, name: true, phone: true },
  });

  if (!customer) {
    throw notFound("Customer not found", "CUSTOMER_NOT_FOUND");
  }

  // No `from` means there is no opening period: the whole history falls
  // inside the window and the opening balance is zero. No dates at all means
  // the window is the entire history — the queries still run, just without a
  // date filter attached.
  const openingBound = from ? { lt: from } : null;
  const windowBound = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: upperExclusive(to) } : {}),
  };

  type SaleLine = { saleCode: string; saleDate: Date; totalAmount: number };
  type CreditLine = {
    returnCode: string;
    returnDate: Date;
    items: { quantity: number; unitPrice: number; taxAmount: number; discount: number }[];
  };
  type PaymentLine = { paymentCode: string; paidAt: Date; amount: number; method: string };

  const saleSelect = { saleCode: true, saleDate: true, totalAmount: true } as const;
  const returnSelect = {
    returnCode: true,
    returnDate: true,
    items: { select: { quantity: true, unitPrice: true, taxAmount: true, discount: true } },
  } as const;
  const paymentSelect = { paymentCode: true, paidAt: true, amount: true, method: true } as const;

  // The date bound is only attached when it carries a comparison — `{}` is
  // truthy but is not a valid filter on a scalar column, and an unbounded
  // window arrives as exactly that. Taken as `unknown` because Prisma's
  // filter union includes scalar shorthand (`string | Date`), which is not
  // assignable to `object` even though every bound built here is a comparison
  // object or `null`.
  const hasBound = (bound: unknown) =>
    Boolean(bound && typeof bound === "object" && Object.keys(bound).length > 0);

  const saleScope = (saleDate?: Prisma.SaleWhereInput["saleDate"]) => ({
    organizationId,
    customerId,
    deletedAt: null,
    status: { not: "Cancelled" },
    ...(hasBound(saleDate) ? { saleDate } : {}),
  });

  const creditScope = (returnDate?: Prisma.ReturnWhereInput["returnDate"]) => ({
    organizationId,
    returnType: "SALE" as const,
    deletedAt: null,
    sale: { customerId },
    ...(hasBound(returnDate) ? { returnDate } : {}),
  });

  const paymentScope = (paidAt?: Prisma.PaymentWhereInput["paidAt"]) => ({
    organizationId,
    customerId,
    deletedAt: null,
    ...(hasBound(paidAt) ? { paidAt } : {}),
  });

  const [openingSales, openingCredits, openingPayments, windowSales, windowCredits, windowPayments] =
    await Promise.all([
      openingBound
        ? prisma.sale.findMany({ where: saleScope(openingBound), select: saleSelect })
        : ([] as SaleLine[]),
      openingBound
        ? prisma.return.findMany({ where: creditScope(openingBound), select: returnSelect })
        : ([] as CreditLine[]),
      openingBound
        ? prisma.payment.findMany({ where: paymentScope(openingBound), select: paymentSelect })
        : ([] as PaymentLine[]),
      prisma.sale.findMany({ where: saleScope(windowBound), select: saleSelect }),
      prisma.return.findMany({ where: creditScope(windowBound), select: returnSelect }),
      prisma.payment.findMany({ where: paymentScope(windowBound), select: paymentSelect }),
    ]);

  // A return's credit is what the customer paid for the goods coming back —
  // line value as invoiced, not a re-derived figure, so a statement's credit
  // always matches the credit note they were given.
  const returnCredit = (
    lines: { quantity: number; unitPrice: number; taxAmount: number; discount: number }[]
  ) =>
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice + line.taxAmount - line.discount, 0);

  const sumDebits = (rows: SaleLine[]) => rows.reduce((s, r) => s + r.totalAmount, 0);
  const sumCredits = (rows: CreditLine[]) => rows.reduce((s, r) => s + returnCredit(r.items), 0);
  const sumPayments = (rows: PaymentLine[]) => rows.reduce((s, r) => s + r.amount, 0);

  const openingBalance =
    sumDebits(openingSales) - sumCredits(openingCredits) - sumPayments(openingPayments);

  // Within one instant an invoice precedes the credit against it, which
  // precedes the payment that settles it — the order the counter saw.
  const typeRank = { invoice: 0, credit: 1, payment: 2 } as const;

  const drafts: Omit<LedgerEntry, "balance">[] = [
    ...windowSales.map((s) => ({
      date: s.saleDate.toISOString(),
      type: "invoice" as const,
      reference: s.saleCode,
      description: `Invoice ${s.saleCode}`,
      debit: s.totalAmount,
      credit: 0,
    })),
    ...windowCredits.map((r) => ({
      date: r.returnDate.toISOString(),
      type: "credit" as const,
      reference: r.returnCode,
      description: `Return credit ${r.returnCode}`,
      debit: 0,
      credit: returnCredit(r.items),
    })),
    ...windowPayments.map((p) => ({
      date: p.paidAt.toISOString(),
      type: "payment" as const,
      reference: p.paymentCode,
      description: `Payment (${p.method})`,
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || typeRank[a.type] - typeRank[b.type]);

  let running = openingBalance;
  const entries: LedgerEntry[] = drafts.map((draft) => {
    running += draft.debit - draft.credit;
    return { ...draft, balance: running };
  });

  const invoices = sumDebits(windowSales);
  const credits = sumCredits(windowCredits);
  const payments = sumPayments(windowPayments);

  return {
    customer,
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    openingBalance,
    entries,
    totals: {
      invoices,
      credits,
      payments,
      closingBalance: openingBalance + invoices - credits - payments,
    },
  };
}
