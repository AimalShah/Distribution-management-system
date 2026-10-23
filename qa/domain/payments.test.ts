/**
 * Domain correctness of payments (Phase 2).
 *
 * The unit suite (`apps/server/src/routes/payment.test.ts`) pins the route with
 * a mocked Prisma; this suite pins the money itself on the real database:
 *
 *   - `Sale.amountPaid` is only ever Σ of the payments that settled it,
 *     moved by the record and by the correction, never by anything else;
 *   - a settlement past the invoice total is refused with the TRUE remaining
 *     (the guard is a conditional update, so two concurrent payments that each
 *     fit the balance they read cannot both land — one 409s);
 *   - a cancelled, deleted, foreign-tenant or foreign-customer invoice
 *     refuses the money (409/400 with the matching code);
 *   - the store-credit pool is Σ(SALE-return credits) − Σ(spent store credit),
 *     where the credits are the SERVER-DERIVED return figures (F-1), draining
 *     cumulatively and freeing again on correction;
 *   - the customer ledger agrees with the rows behind it: closing balance =
 *     max(0, invoices − return credits − payments) at every stage, a credit
 *     that overflows shows in the raw totals and floors the balance at 0
 *     (ADR 0006 / a79d993), and a corrected payment leaves the totals.
 *
 * Findings: the payment domain held — every assertion here passed on first
 * contact (probed live against the local DB first, like the returns suite).
 * The suite exists so the money semantics cannot regress silently.
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";

import prisma from "@dms/db";
import {
  ApiError,
  api,
  createIsolatedCustomer,
  createPayment,
  createReturn,
  createSale,
  expectMoney,
  expectRefusal,
  round2,
  saleDetail,
  seedStock,
  seedTenant,
  teardownTenant,
  unique,
  type Caller,
  type Tenant,
} from "../support/harness";

let t!: Tenant;

beforeAll(async () => {
  t = await seedTenant(10); // gstRate 10% on every product
});

afterAll(async () => {
  await teardownTenant(t);
  await prisma.$disconnect();
});

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */

const raw = (m: string, p: string, b?: unknown) => api.raw(t)(m as any, p, b);

const expectOk = async (resP: Promise<any>) => {
  const res = await resP;

  if (res.status >= 400) {
    throw new ApiError(res.status, res.body, res.request?.method ?? "?", res.request?.url ?? "?");
  }

  return res;
};

const newProduct = async (name: string) => {
  const res = await expectOk(
    raw("post", "/products", {
      name: unique(name),
      category: t.categoryId,
      brand: t.brandId,
      unit: "piece",
      unitCost: 10,
      unitPrice: 25,
      gstApplicable: true,
      gstRate: 10,
      isActive: true,
    })
  );

  return res.body as { id: string };
};

const stock = async (productId: string, quantityOnHand = 100) =>
  (await expectOk(raw("post", "/inventory", { productId, quantityOnHand }))).body;

/** The named scenario's own formula: 25/unit product, 10% GST, no header discount. */
const totalOf = (quantity: number): number => round2(quantity * 25 * 1.1);

const pay = (draft: { customerId: string; saleId?: string; amount: number; method?: string }) =>
  raw("post", "/payments", {
    paymentCode: unique("PAY"),
    customerId: draft.customerId,
    saleId: draft.saleId,
    amount: draft.amount,
    method: draft.method ?? "Cash",
  });

const paidPayment = async (draft: { customerId: string; saleId?: string; amount: number; method?: string }) => {
  const res = await expectOk(pay(draft));

  return res.body as { id: string; paymentCode: string };
};

const ledger = async (customerId: string, query = "") => {
  const res = await expectOk(raw("get", `/customers/${customerId}/ledger${query}`));

  return res.body as {
    totals: { invoices: number; credits: number; payments: number; closingBalance: number };
    entries: { date: string; type: string; debit: number; credit: number; balance: number }[];
  };
};

const cancel = (saleId: string) => raw("post", `/sales/${saleId}/cancel`);
const deleteSale = (saleId: string) => raw("delete", `/sales/${saleId}`);
const correctPayment = async (paymentId: string) => {
  const res = await raw("delete", `/payments/${paymentId}`);

  return res;
};

/* -------------------------------------------------------------------------- */

describe("payments — guarded settlement of Sale.amountPaid", () => {
  it("multiple payments accumulate; amountPaid stays Σ settled payments", async () => {
    const p = await newProduct("pay-accum");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "accum");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });

    expectMoney((await saleDetail(t, sale.id)).totalAmount, 137.5); // 5×25 + 10%

    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: 60 });
    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: 30 });

    expectMoney((await saleDetail(t, sale.id)).amountPaid, 90);

    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: 47.49 });

    expectMoney((await saleDetail(t, sale.id)).amountPaid, 137.49);
  });

  it("a payment past the total is refused with the true remaining, and writes nothing", async () => {
    const p = await newProduct("pay-over");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "over");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });

    for (const amount of [60, 30, 47.49]) {
      await createPayment(t, { customerId: customer.id, saleId: sale.id, amount });
    }

    const body = await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 0.02 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "PAYMENT_EXCEEDS_BALANCE"
    );

    expectMoney(body?.details?.remaining, 0.01);

    // The refused attempt wrote nothing.
    expectMoney((await saleDetail(t, sale.id)).amountPaid, 137.49);
  });

  it("two concurrent payments for the full total: exactly one settles, and only one claim row exists", async () => {
    const p = await newProduct("pay-race");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "race");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });
    const total = (await saleDetail(t, sale.id)).totalAmount;
    expectMoney(total, 137.5);

    const attempt = async () => (await pay({ customerId: customer.id, saleId: sale.id, amount: total })).status;

    const [first, second] = await Promise.all([attempt(), attempt()]);
    expect([first, second].filter((status) => status === 201)).toHaveLength(1);

    expectMoney((await saleDetail(t, sale.id)).amountPaid, total);

    // One saved payment row, against the invoice — the loser left nothing behind.
    const page = (await expectOk(raw("get", `/payments?saleId=${sale.id}&pageSize=100`))).body;
    const rows = page?.data ?? page;

    expect(rows.filter((r: { saleId: string | null }) => r.saleId === sale.id)).toHaveLength(1);
  });

  it("settling an already-settled invoice is refused", async () => {
    const p = await newProduct("pay-settled");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "settled");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });
    const total = (await saleDetail(t, sale.id)).totalAmount;

    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: total });

    expectMoney((await saleDetail(t, sale.id)).amountPaid, total);

    await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 1 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "PAYMENT_EXCEEDS_BALANCE"
    );
  });
});

describe("payments — gates on the named invoice", () => {
  it("an invoice from another organization is refused", async () => {
    const otherCaller: Caller = { organizationId: t.other.organizationId, userId: t.other.userId };
    await seedStock(otherCaller, t.other.products[0], 10);
    const otherSale = await createSale(otherCaller, {
      customerId: t.other.customer.id,
      items: [{ productId: t.other.products[0].id, quantity: 1 }],
    }) as { id: string };

    const customer = await createIsolatedCustomer(t, "foreign-org");

    await expectRefusal(
      raw("post", "/payments", {
        paymentCode: unique("PAY"),
        customerId: customer.id,
        saleId: otherSale.id,
        amount: 10,
        method: "Cash",
      }).then((r) => ({ status: r.status, body: r.body })),
      400,
      "SALE_NOT_IN_ORGANIZATION"
    );
  });

  it("an invoice of a different customer is refused, and the invoice takes nothing", async () => {
    const p = await newProduct("pay-mismatch");
    await stock(p.id);
    const owner = await createIsolatedCustomer(t, "owner");
    const payer = await createIsolatedCustomer(t, "payer");
    const sale = await createSale(t, { customerId: owner.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectRefusal(
      pay({ customerId: payer.id, saleId: sale.id, amount: 5 }).then((r) => ({ status: r.status, body: r.body })),
      400,
      "SALE_CUSTOMER_MISMATCH"
    );

    expectMoney((await saleDetail(t, sale.id)).amountPaid, 0);
  });

  it("a cancelled invoice refuses payment", async () => {
    const p = await newProduct("pay-cancelled");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "cancelled");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(cancel(sale.id));

    await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 5 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "SALE_CANCELLED"
    );
  });

  it("a deleted invoice refuses payment", async () => {
    const p = await newProduct("pay-deleted-inv");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "deleted");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(deleteSale(sale.id));

    await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 5 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "SALE_DELETED"
    );
  });

  it("an invoice with money on it cannot be cancelled or deleted; after a correction, it can", async () => {
    const p = await newProduct("pay-gates");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "gates");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    const total = (await saleDetail(t, sale.id)).totalAmount;
    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total, method: "Cheque" });

    const cancelRefused = await cancel(sale.id);
    expect(cancelRefused.status).toBe(409);
    expect(cancelRefused.body?.code).toBe("SALE_HAS_PAYMENTS");

    const deleteRefused = await deleteSale(sale.id);
    expect(deleteRefused.status).toBe(409);
    expect(deleteRefused.body?.code).toBe("SALE_HAS_PAYMENTS");

    await expectOk(correctPayment(payment.id));

    expectMoney((await saleDetail(t, sale.id)).amountPaid, 0);

    await expectOk(deleteSale(sale.id));
  });
});

describe("payments — the store-credit pool", () => {
  /** One return, one derived credit (server figures): 2 × 25 + 5 tax = 55. */
  const returnCredit55 = async (label: string) => {
    const p = await newProduct(`sc-${label}`);
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, label);
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });
    expectMoney((await saleDetail(t, sale.id)).totalAmount, 137.5);

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      customerId: customer.id,
      items: [{ productId: p.id, quantity: 2 }],
    });

    return { p, customer, sale };
  };

  it("drains cumulatively, and the overdraw refusal carries the true available", async () => {
    const { p, customer } = await returnCredit55("drain");

    const spend = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 3 }] });
    expectMoney((await saleDetail(t, spend.id)).totalAmount, 82.5);

    await paidPayment({
      customerId: customer.id,
      saleId: spend.id,
      amount: 54.8,
      method: "Store Credit",
    });

    // The store credit settled the named invoice too.
    expectMoney((await saleDetail(t, spend.id)).amountPaid, 54.8);

    await paidPayment({
      customerId: customer.id,
      saleId: spend.id,
      amount: 0.1,
      method: "Store Credit",
    });

    expectMoney((await saleDetail(t, spend.id)).amountPaid, 54.9);

    // 55 − 54.9 = 0.1 left; 0.2 is refused with that remainder — not the
    // invoice's remaining balance.
    const refusedBody = await expectRefusal(
      pay({ customerId: customer.id, amount: 0.2, method: "Store Credit" }).then((r) => ({
        status: r.status,
        body: r.body,
      })),
      409,
      "INSUFFICIENT_STORE_CREDIT"
    );

    expectMoney(refusedBody?.details?.available, 0.1);
  });

  it("a corrected store-credit payment frees the credit, which spends against a new invoice", async () => {
    const { p, customer } = await returnCredit55("frees");

    const firstSale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 3 }] });
    const payment = await paidPayment({
      customerId: customer.id,
      saleId: firstSale.id,
      amount: 55,
      method: "Store Credit",
    });

    expectMoney((await saleDetail(t, firstSale.id)).amountPaid, 55);

    await expectOk(correctPayment(payment.id));

    expectMoney((await saleDetail(t, firstSale.id)).amountPaid, 0);

    // The freed credit pays a different invoice in full.
    const secondSale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    expectMoney((await saleDetail(t, secondSale.id)).totalAmount, 55);

    await paidPayment({
      customerId: customer.id,
      saleId: secondSale.id,
      amount: 55,
      method: "Store Credit",
    });

    expectMoney((await saleDetail(t, secondSale.id)).amountPaid, 55);
  });

  it("a store-credit overdraw from a customer with NO returns is refused with zero available", async () => {
    const p = await newProduct("sc-empty");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "empty-pool");

    // Give the invoice room so the refusal cannot masquerade as a balance error.
    await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    const body = await expectRefusal(
      raw("post", "/payments", {
        paymentCode: unique("PAY"),
        customerId: customer.id,
        amount: 5,
        method: "Store Credit",
      }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "INSUFFICIENT_STORE_CREDIT"
    );

    expectMoney(body?.available ?? body?.details?.available, 0);
  });
});

describe("payments — corrections", () => {
  it("a corrected settling payment reduces amountPaid and frees the headroom", async () => {
    const p = await newProduct("corr-headroom");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "corr-headroom");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    const total = (await saleDetail(t, sale.id)).totalAmount;
    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total });

    expectMoney((await saleDetail(t, sale.id)).amountPaid, total);

    await expectOk(correctPayment(payment.id));

    expectMoney((await saleDetail(t, sale.id)).amountPaid, 0);

    // The freed headroom accepts a fresh settlement.
    await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total });
    expectMoney((await saleDetail(t, sale.id)).amountPaid, total);
  });

  it("correcting the same payment twice is refused", async () => {
    const p = await newProduct("corr-twice");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "corr-twice");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });
    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: totalOf(1) });

    await expectOk(correctPayment(payment.id));

    const second = await correctPayment(payment.id);
    expect(second.status).toBe(409);
    expect(second.body?.code).toBe("PAYMENT_ALREADY_DELETED");
  });

  it("a corrected cash-on-account payment leaves the invoice untouched and the ledger consistent", async () => {
    const p = await newProduct("corr-account");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "corr-account");
    await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 4 }] });

    const before = await ledger(customer.id);
    expectMoney(before.totals.invoices, 110); // 4×25 + 10%

    const payment = await paidPayment({ customerId: customer.id, amount: 25, method: "Cash" });

    const withCash = await ledger(customer.id);
    expectMoney(withCash.totals.payments, 25);

    await expectOk(correctPayment(payment.id));

    const after = await ledger(customer.id);
    expectMoney(after.totals.payments, 0);
    expectMoney(after.totals.closingBalance, before.totals.closingBalance);
  });

  it("the same paymentCode cannot be recorded twice — the accidental double-submit guard", async () => {
    const p = await newProduct("corr-dup");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "corr-dup");
    const code = unique("PAY");

    await expectOk(
      raw("post", "/payments", { paymentCode: code, customerId: customer.id, amount: 5, method: "Cash" })
    );

    const dup = await raw("post", "/payments", { paymentCode: code, customerId: customer.id, amount: 5, method: "Cash" });

    expect(dup.status).toBe(409);
    // One row only.
    const page = (await expectOk(raw("get", `/payments?pageSize=100&customerId=${customer.id}`))).body;
    const rows = page?.data ?? page;

    expect(rows.filter((r: { paymentCode: string }) => r.paymentCode === code)).toHaveLength(1);
  });
});

describe("payments — the customer ledger reconciles against the rows", () => {
  it("closing balance = max(0, invoices − credits − payments) at every stage, including the credit-overflow floor", async () => {
    const p = await newProduct("led-stages");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "stages");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });
    const total = (await saleDetail(t, sale.id)).totalAmount;
    expectMoney(total, 137.5);

    const afterInvoice = await ledger(customer.id);
    expectMoney(afterInvoice.totals.invoices, 137.5);
    expectMoney(afterInvoice.totals.closingBalance, 137.5);

    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: 68.75 });

    const afterHalf = await ledger(customer.id);
    expectMoney(afterHalf.totals.payments, 68.75);
    expectMoney(afterHalf.totals.closingBalance, 68.75);

    // Full return: a 137.5 credit against a 68.75 balance. The raw totals
    // carry the whole credit; the balance floors at 0 − the overflow is
    // unspent store credit, not a negative trade balance (ADR 0006).
    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      customerId: customer.id,
      items: [{ productId: p.id, quantity: 5 }],
    });

    const afterReturn = await ledger(customer.id);
    expectMoney(afterReturn.totals.credits, 137.5);
    expectMoney(afterReturn.totals.closingBalance, 0);

    // The running column never goes negative on the way either.
    for (const entry of afterReturn.entries) {
      expect(entry.balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("a mid-window statement: the opening balance is the floored pre-window truth and excludes past rows from the window", async () => {
    const p = await newProduct("led-window");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "window");
    const early = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    expectMoney((await saleDetail(t, early.id)).totalAmount, 55);

    await createPayment(t, { customerId: customer.id, saleId: early.id, amount: 30 });

    // Warp the early invoice AND its payment two days back; the second invoice
    // is created today. Otherwise the receipt would sit inside the window and
    // the opening balance would read 55, not the 25 owed net of the payment.
    const earlyDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.sale.update({ where: { id: early.id }, data: { saleDate: earlyDate } });
    const receipt = await raw("get", `/payments?customerId=${customer.id}&saleId=${early.id}`);
    const receiptRow = ((receipt.body?.data ?? receipt.body) as { id: string }[])[0];
    await prisma.payment.update({ where: { id: receiptRow.id }, data: { paidAt: earlyDate } });

    await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    // Window opens after the early invoice's day: 25 owed now, opening = 55 − 30.
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const statement = await ledger(customer.id, `?from=${from.toISOString().slice(0, 10)}`);

    expectMoney(statement.openingBalance, 25);
    // The window's own rows: only today's invoice. The early invoice and its
    // payment live in the opening balance alone.
    expectMoney(statement.totals?.invoices ?? 0, 27.5);
  });

  it("a corrected payment inside the window drops out of the running arithmetic, not just the totals", async () => {
    const p = await newProduct("led-corrected");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "led-cor");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });

    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: 68.75 });

    const withPayment = await ledger(customer.id);
    expectMoney(withPayment.totals.closingBalance, 68.75);
    expect(withPayment.entries.filter((e) => e.type === "payment")).toHaveLength(1);

    await expectOk(correctPayment(payment.id));

    const corrected = await ledger(customer.id);
    expectMoney(corrected.totals.closingBalance, 137.5);
    expect(corrected.entries.filter((e) => e.type === "payment")).toHaveLength(0);
  });
});
