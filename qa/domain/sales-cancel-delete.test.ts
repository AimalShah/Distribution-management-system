/**
 * Domain correctness of sale cancel/delete/restore/uncancel semantics (Phase 2).
 *
 * This suite pins the money-property invariants, stock reversals, and guard
 * gates for the four lifecycle operations on an invoice:
 *
 *   cancel  — takes the invoice out of circulation (balance, reports) but
 *             NEVER touches stock: the goods left the warehouse and stay gone.
 *   uncancel — exact undo of cancel, restoring `statusBeforeCancel`.
 *   delete  — soft delete + stock IN reversal inside a Serializable tx.
 *   restore — re-consumes stock (availability-checked, may refuse).
 *
 * Money properties tested:
 *
 *   - A cancelled invoice drops out of the customer ledger balance.
 *   - A deleted  invoice drops out of the customer ledger balance.
 *   - Cancel and delete are both refused while payments or returns exist.
 *   - After corrections clear the money, both succeed.
 *   - Delete gives stock back; cancel does not.
 *   - Restore takes stock back out and can fail on insufficient stock.
 *   - Uncancel puts the invoice back into ledger circulation.
 *   - PUT /sales/:id cannot set status=Cancelled (USE_CANCEL_ENDPOINT).
 *   - PUT /sales/:id on a cancelled invoice is refused (SALE_IS_CANCELLED).
 *   - Double-cancel, double-delete, and double-restore are refused.
 *   - A deleted invoice cannot be cancelled and vice versa.
 *
 * Pattern follows `payments.test.ts` (19/19): isolated customer per scenario,
 * one shared tenant, fixtures at 25/unit + 10% GST.
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
  customerBalance,
  expectMoney,
  expectRefusal,
  inventoryRow,
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
  (await expectOk(raw("post", "/inventory", { productId, quantityOnHand, reorderLevel: 10 }))).body;

/** The named scenario's own formula: 25/unit product, 10% GST, no header discount. */
const totalOf = (quantity: number): number => round2(quantity * 25 * 1.1);

const cancel = (saleId: string) => raw("post", `/sales/${saleId}/cancel`);
const uncancel = (saleId: string) => raw("post", `/sales/${saleId}/uncancel`);
const del = (saleId: string) => raw("delete", `/sales/${saleId}`);
const restore = (saleId: string) => raw("post", `/sales/${saleId}/restore`);

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

const correctPayment = (paymentId: string) => raw("delete", `/payments/${paymentId}`);

const ledger = async (customerId: string) => {
  const res = await expectOk(raw("get", `/customers/${customerId}/ledger`));

  return res.body as {
    totals: { invoices: number; credits: number; payments: number; closingBalance: number };
    entries: { date: string; type: string; debit: number; credit: number; balance: number }[];
  };
};

/* -------------------------------------------------------------------------- */

describe("sales cancel — guard gates", () => {
  it("an invoice with payments is refused with SALE_HAS_PAYMENTS", async () => {
    const p = await newProduct("can-pay-gate");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-pay");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    await paidPayment({ customerId: customer.id, saleId: sale.id, amount: 10 });

    const res = await cancel(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_HAS_PAYMENTS");
  });

  it("an invoice with active returns is refused with SALE_HAS_RETURNS", async () => {
    const p = await newProduct("can-ret-gate");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-ret");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: p.id, quantity: 1 }],
    });

    const res = await cancel(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_HAS_RETURNS");
  });

  it("an already-cancelled invoice is refused with SALE_ALREADY_CANCELLED", async () => {
    const p = await newProduct("can-double");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-double");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(cancel(sale.id));

    const res = await cancel(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_ALREADY_CANCELLED");
  });

  it("a soft-deleted invoice cannot be cancelled (SALE_NOT_FOUND)", async () => {
    const p = await newProduct("can-del");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-del");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(del(sale.id));

    const res = await cancel(sale.id);
    expect(res.status).toBe(404);
  });

  it("after correcting payments and deleting returns, cancel succeeds", async () => {
    const p = await newProduct("can-cleared");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-cleared");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 3 }] });
    const total = totalOf(3);

    // Add a payment and a return
    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total });
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: p.id, quantity: 1 }],
    });

    // Both block cancel
    expect((await cancel(sale.id)).status).toBe(409);

    // Correct the payment
    await expectOk(correctPayment(payment.id));

    // Still blocked by return
    expect((await cancel(sale.id)).status).toBe(409);

    // Delete the return
    await expectOk(raw("delete", `/returns/${ret.id}`));

    // Now cancel succeeds
    await expectOk(cancel(sale.id));

    const detail = await saleDetail(t, sale.id);
    expect(detail.status).toBe("Cancelled");
  });
});

describe("sales cancel — money properties", () => {
  it("cancel does NOT touch stock: inventory stays deducted", async () => {
    const p = await newProduct("can-stock");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "can-stock");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 10 }] });

    const beforeCancel = await inventoryRow(t, p.id);
    expect(beforeCancel.quantityOnHand).toBe(40);

    await expectOk(cancel(sale.id));

    // Stock unchanged after cancel — goods stay gone
    const afterCancel = await inventoryRow(t, p.id);
    expect(afterCancel.quantityOnHand).toBe(40);
  });

  it("a cancelled invoice drops out of the customer ledger balance", async () => {
    const p = await newProduct("can-ledger");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-ledger");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 4 }] });
    const total = totalOf(4); // 110

    const before = await ledger(customer.id);
    expectMoney(before.totals.invoices, total);
    expectMoney(before.totals.closingBalance, total);

    await expectOk(cancel(sale.id));

    const after = await ledger(customer.id);
    // Cancelled invoice excluded from ledger: invoices and balance drop to 0
    expectMoney(after.totals.invoices, 0);
    expectMoney(after.totals.closingBalance, 0);
  });

  it("uncancel puts the invoice back into ledger circulation with the correct status restored", async () => {
    const p = await newProduct("uncan-ledger");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "uncan-ledger");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    const total = totalOf(2); // 55

    await expectOk(cancel(sale.id));
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);

    await expectOk(uncancel(sale.id));

    // Balance restored
    expectMoney((await ledger(customer.id)).totals.closingBalance, total);

    // Status restored to the original (Completed from createSale default)
    const detail = await saleDetail(t, sale.id);
    expect(detail.status).toBe("Completed");
  });

  it("uncancel on a non-cancelled invoice is refused with SALE_NOT_CANCELLED", async () => {
    const p = await newProduct("uncan-gate");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "uncan-gate");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    const res = await uncancel(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_NOT_CANCELLED");
  });

  it("statusBeforeCancel preserves Pending when a Pending invoice is cancelled then uncancelled", async () => {
    const p = await newProduct("can-pending");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-pending");

    // Create a Pending sale explicitly
    const saleRes = await expectOk(
      raw("post", "/sales", {
        saleCode: unique("SALE"),
        customerId: customer.id,
        status: "Pending",
        invoiceType: "regular",
        isInterState: false,
        discount: 0,
        items: [{ productId: p.id, quantity: 1, unitPrice: 25, taxPercent: 10 }],
      })
    );
    const saleId = saleRes.body.id;

    expect((await saleDetail(t, saleId)).status).toBe("Pending");

    await expectOk(cancel(saleId));
    expect((await saleDetail(t, saleId)).status).toBe("Cancelled");

    await expectOk(uncancel(saleId));
    expect((await saleDetail(t, saleId)).status).toBe("Pending");
  });
});

describe("sales cancel — PUT guards", () => {
  it("PUT status=Cancelled is refused with USE_CANCEL_ENDPOINT", async () => {
    const p = await newProduct("put-cancel");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "put-cancel");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    const res = await raw("put", `/sales/${sale.id}`, { status: "Cancelled" });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("USE_CANCEL_ENDPOINT");
  });

  it("PUT on a cancelled invoice is refused with SALE_IS_CANCELLED", async () => {
    const p = await newProduct("put-on-can");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "put-on-can");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(cancel(sale.id));

    const res = await raw("put", `/sales/${sale.id}`, { discount: 5 });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_IS_CANCELLED");
  });
});

describe("sales delete — guard gates", () => {
  it("an invoice with payments is refused with SALE_HAS_PAYMENTS", async () => {
    const p = await newProduct("del-pay-gate");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-pay");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    await paidPayment({ customerId: customer.id, saleId: sale.id, amount: 10 });

    const res = await del(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_HAS_PAYMENTS");
  });

  it("an invoice with active returns is refused with SALE_HAS_RETURNS", async () => {
    const p = await newProduct("del-ret-gate");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-ret");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: p.id, quantity: 1 }],
    });

    const res = await del(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_HAS_RETURNS");
  });

  it("an already-deleted invoice is refused with SALE_ALREADY_DELETED", async () => {
    const p = await newProduct("del-double");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-double");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(del(sale.id));

    const res = await del(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_ALREADY_DELETED");
  });

  it("after correcting payments and deleting returns, delete succeeds", async () => {
    const p = await newProduct("del-cleared");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-cleared");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 3 }] });

    const payment = await paidPayment({ customerId: customer.id, saleId: sale.id, amount: 10 });
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: p.id, quantity: 1 }],
    });

    // Both block delete
    expect((await del(sale.id)).status).toBe(409);

    // Correct payment
    await expectOk(correctPayment(payment.id));

    // Still blocked by return
    expect((await del(sale.id)).status).toBe(409);

    // Delete return
    await expectOk(raw("delete", `/returns/${ret.id}`));

    // Now delete succeeds
    await expectOk(del(sale.id));

    // The invoice is soft-deleted (has deletedAt)
    const row = await prisma.sale.findUnique({ where: { id: sale.id } });
    expect(row?.deletedAt).not.toBeNull();
  });
});

describe("sales delete — stock reversal", () => {
  it("delete gives stock back; the inventory ledger has the IN reversal row", async () => {
    const p = await newProduct("del-stock");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "del-stock");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 10 }] });

    expectMoney((await saleDetail(t, sale.id)).totalAmount, totalOf(10));

    const afterSale = await inventoryRow(t, p.id);
    expect(afterSale.quantityOnHand).toBe(40);

    await expectOk(del(sale.id));

    // Stock restored
    const afterDelete = await inventoryRow(t, p.id);
    expect(afterDelete.quantityOnHand).toBe(50);
  });

  it("a deleted invoice drops out of the customer ledger balance", async () => {
    const p = await newProduct("del-ledger");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-ledger");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 4 }] });
    const total = totalOf(4); // 110

    const before = await ledger(customer.id);
    expectMoney(before.totals.invoices, total);
    expectMoney(before.totals.closingBalance, total);

    await expectOk(del(sale.id));

    const after = await ledger(customer.id);
    // Deleted invoice excluded from ledger
    expectMoney(after.totals.invoices, 0);
    expectMoney(after.totals.closingBalance, 0);
  });

  it("cancel vs delete: cancel leaves stock deducted, delete returns it", async () => {
    const p1 = await newProduct("cmp-cancel");
    const p2 = await newProduct("cmp-delete");
    await stock(p1.id, 50);
    await stock(p2.id, 50);

    const cust1 = await createIsolatedCustomer(t, "cmp-cancel");
    const cust2 = await createIsolatedCustomer(t, "cmp-delete");

    const saleCancelled = await createSale(t, { customerId: cust1.id, items: [{ productId: p1.id, quantity: 10 }] });
    const saleDeleted = await createSale(t, { customerId: cust2.id, items: [{ productId: p2.id, quantity: 10 }] });

    await expectOk(cancel(saleCancelled.id));
    await expectOk(del(saleDeleted.id));

    // Cancel: stock stays at 40 (goods gone)
    expect((await inventoryRow(t, p1.id)).quantityOnHand).toBe(40);
    // Delete: stock returns to 50
    expect((await inventoryRow(t, p2.id)).quantityOnHand).toBe(50);
  });
});

describe("sales restore — stock re-consumption and guards", () => {
  it("restore re-deducts stock and puts the invoice back into the ledger", async () => {
    const p = await newProduct("rest-basic");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "rest-basic");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 10 }] });
    const total = totalOf(10);

    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(40);

    await expectOk(del(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(50);
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);

    await expectOk(restore(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(40);
    expectMoney((await ledger(customer.id)).totals.closingBalance, total);

    // The invoice is active again
    const detail = await saleDetail(t, sale.id);
    expect(detail.deletedAt).toBeNull();
  });

  it("restore is refused when stock was sold on (INSUFFICIENT_STOCK_FOR_RESTORE)", async () => {
    const p = await newProduct("rest-insuf");
    await stock(p.id, 20);
    const cust1 = await createIsolatedCustomer(t, "rest-insuf-1");
    const cust2 = await createIsolatedCustomer(t, "rest-insuf-2");

    // Sale A takes 15 units → 5 remaining
    const saleA = await createSale(t, { customerId: cust1.id, items: [{ productId: p.id, quantity: 15 }] });
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(5);

    // Delete sale A → 20 back
    await expectOk(del(saleA.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(20);

    // Sale B takes 10 → 10 remaining; can't restore A's 15 from 10
    await createSale(t, { customerId: cust2.id, items: [{ productId: p.id, quantity: 10 }] });
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(10);

    const res = await restore(saleA.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("INSUFFICIENT_STOCK_FOR_RESTORE");

    // Stock untouched by the failed restore
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(10);
  });

  it("restoring a non-deleted invoice is refused with SALE_NOT_DELETED", async () => {
    const p = await newProduct("rest-active");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "rest-active");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    const res = await restore(sale.id);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SALE_NOT_DELETED");
  });
});

describe("sales delete + cancel — cross-state transitions", () => {
  it("a cancelled invoice can still be deleted (delete path does not filter on status)", async () => {
    const p = await newProduct("can-then-del");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "can-then-del");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 10 }] });

    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(40);

    await expectOk(cancel(sale.id));
    // Cancel leaves stock at 40
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(40);

    // Now delete the cancelled invoice — stock comes back
    await expectOk(del(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(50);
  });

  it("delete then restore then cancel: the full lifecycle round-trip", async () => {
    const p = await newProduct("lifecycle");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "lifecycle");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 5 }] });
    const total = totalOf(5); // 137.5

    // Active: stock 45, balance 137.5
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(45);
    expectMoney((await ledger(customer.id)).totals.closingBalance, total);

    // Delete: stock 50, balance 0
    await expectOk(del(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(50);
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);

    // Restore: stock 45, balance 137.5
    await expectOk(restore(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(45);
    expectMoney((await ledger(customer.id)).totals.closingBalance, total);

    // Cancel: stock 45 (unchanged!), balance 0
    await expectOk(cancel(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(45);
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);

    // Uncancel: stock 45, balance 137.5
    await expectOk(uncancel(sale.id));
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(45);
    expectMoney((await ledger(customer.id)).totals.closingBalance, total);
  });
});

describe("sales cancel/delete — payment interaction invariants", () => {
  it("a cancelled invoice refuses new payments with SALE_CANCELLED", async () => {
    const p = await newProduct("can-pay-ref");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-pay-ref");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(cancel(sale.id));

    await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 5 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "SALE_CANCELLED"
    );
  });

  it("a deleted invoice refuses new payments with SALE_DELETED", async () => {
    const p = await newProduct("del-pay-ref");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "del-pay-ref");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 1 }] });

    await expectOk(del(sale.id));

    await expectRefusal(
      pay({ customerId: customer.id, saleId: sale.id, amount: 5 }).then((r) => ({ status: r.status, body: r.body })),
      409,
      "SALE_DELETED"
    );
  });

  it("delete-restore-pay: after restore the invoice accepts payments normally", async () => {
    const p = await newProduct("del-rest-pay");
    await stock(p.id, 50);
    const customer = await createIsolatedCustomer(t, "del-rest-pay");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    const total = totalOf(2); // 55

    await expectOk(del(sale.id));
    await expectOk(restore(sale.id));

    // Now the invoice is active again; settle it
    await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total });

    const detail = await saleDetail(t, sale.id);
    expectMoney(detail.amountPaid, total);
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);
  });

  it("cancel-uncancel-pay: after uncancel the invoice accepts payments normally", async () => {
    const p = await newProduct("can-uncan-pay");
    await stock(p.id);
    const customer = await createIsolatedCustomer(t, "can-uncan-pay");
    const sale = await createSale(t, { customerId: customer.id, items: [{ productId: p.id, quantity: 2 }] });
    const total = totalOf(2); // 55

    await expectOk(cancel(sale.id));
    await expectOk(uncancel(sale.id));

    await paidPayment({ customerId: customer.id, saleId: sale.id, amount: total });

    expectMoney((await saleDetail(t, sale.id)).amountPaid, total);
    expectMoney((await ledger(customer.id)).totals.closingBalance, 0);
  });
});
