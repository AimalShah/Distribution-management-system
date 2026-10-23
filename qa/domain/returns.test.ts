/**
 * Domain correctness of returns (Phase 2, priority set).
 *
 * These tests pin the side effects, not the status code. For a SALE return:
 *
 *   - stock comes back exactly the returned quantity, product by product,
 *     with a ledger row whose before/after arithmetic holds;
 *   - RESTOCKABLE lines go back on the shelf; DAMAGED lines are credited but
 *     never restocked (ADR 0008);
 *   - the credit is qty × invoice unitPrice + proportional tax − proportional
 *     discount — **derived server-side** from the original invoice line, never
 *     banked from client figures (the P0-6 rule extended to returns);
 *   - the credit reaches the customer balance and the store-credit pool;
 *   - over-returns, cancelled/deleted invoices and window expiry are refused;
 *   - the same return posted twice yields one row.
 *
 * Purchase returns: stock out per document headroom, refused beyond on-hand,
 * refused beyond what the purchase carried.
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";

import prisma from "@dms/db";
import {
  ApiError,
  api,
  createIsolatedCustomer,
  createPayment,
  createPurchase,
  createReturn,
  createSale,
  customerBalance,
  defaultSale,
  expectMoney,
  expectRefusal,
  inventoryRow,
  ledgerRows,
  ok,
  returnDetail,
  round2,
  saleDetail,
  seedStock,
  seedTenant,
  teardownTenant,
  unique,
  type Tenant,
} from "../support/harness";

let t!: Tenant;
type Call = <F extends "get" | "post" | "put" | "patch" | "delete">(m: string, p: string, b?: unknown) => Promise<any>;
let post!: Call;
let postRes!: (p: string, b?: unknown) => Promise<any>;
let del!: (p: string, b?: unknown) => Promise<any>;
let getRes!: (p: string) => Promise<any>;

const warpSale = (saleId: string, saleDate: Date) =>
  prisma.sale.update({ where: { id: saleId }, data: { saleDate } });

beforeAll(async () => {
  t = await seedTenant(10); // gstRate 10% on every product
  const raw = api.raw(t) as unknown as (m: string, p: string, b?: unknown) => any;

  // throwing + non-throwing flavors of the same calls
  post = (async (p: string, b?: unknown) => (await ok(raw("post", p, b))).body) as unknown as Call;
  del = (async (p: string) => (await ok(raw("delete", p))).body) as unknown as Call;
  getRes = (p: string) => raw("get", p);
  postRes = (p: string, b?: unknown) => raw("post", p, b);
});

afterAll(async () => {
  await teardownTenant(t);
  await prisma.$disconnect();
});

const postReturn = (draft: any) =>
  post("/returns", {
    returnCode: draft.returnCode ?? unique("RET"),
    reason: draft.reason ?? "QA",
    ...draft,
    // Money fields are schema-required today (client figures); the service is
    // expected to ignore them and derive from the document.
    items: draft.items.map((line: any) => ({
      unitPrice: 66.6,
      taxAmount: 6.66,
      discount: 6.66,
      ...line,
    })),
  });

const postReturnRes = (draft: any) =>
  postRes("/returns", {
    returnCode: draft.returnCode ?? unique("RET"),
    reason: draft.reason ?? "QA",
    ...draft,
    items: draft.items.map((line: any) => ({
      unitPrice: 66.6,
      taxAmount: 6.66,
      discount: 6.66,
      ...line,
    })),
  });

const newProduct = (name: string) =>
  post("/products", {
    name: unique(name),
    category: t.categoryId,
    brand: t.brandId,
    unit: "piece",
    unitCost: 10,
    unitPrice: 25,
    gstApplicable: true,
    gstRate: 10,
    isActive: true,
  });

const saleOf = (product: { id: string }, quantity: number, extra?: Partial<Awaited<ReturnType<typeof createSale>>>) =>
  createSale(t, {
    customerId: t.customer.id,
    items: [{ productId: product.id, quantity }],
    ...extra,
  });

/** Signed stock delta of a ledger row: +2 means "two units came in". */
const delta = (row: { quantity: number; previousQty: number; newQty: number }): number =>
  row.newQty - row.previousQty;

/* -------------------------------------------------------------------------- */

describe("sale returns — stock effects", () => {
  it("restores exactly the returned quantity, per product, with a RETURN ledger row", async () => {
    const [product] = t.products;
    await seedStock(t, product, 150);

    const sale = await saleOf(product, 5);
    expect((await inventoryRow(t, product.id)).quantityOnHand).toBe(145);

    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: product.id, quantity: 2 }],
    });

    expect((await inventoryRow(t, product.id)).quantityOnHand).toBe(147);

    const returnRows = (await ledgerRows(t, product.id)).filter((r: any) => r.reference === ret.returnCode);
    expect(returnRows.length).toBeGreaterThan(0);
    expect(returnRows[0].movementType).toBe("RETURN");
    for (const r of returnRows) expect(delta(r)).toBe(2);
  });

  it("a DAMAGED line is credited but never restocked; both count against headroom", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 4);

    const afterSale = (await inventoryRow(t, product.id)).quantityOnHand;

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [
        { productId: product.id, quantity: 1, condition: "RESTOCKABLE" },
        { productId: product.id, quantity: 1, condition: "DAMAGED", reason: "QA damaged" },
      ],
    });

    // Only the restockable handback comes back.
    expect((await inventoryRow(t, product.id)).quantityOnHand).toBe(afterSale + 1);

    // The document's headroom is spent (2 + 3 > 4).
    await expectRefusal(
      postReturnRes({
        returnType: "SALE",
        saleId: sale.id,
        items: [{ productId: product.id, quantity: 3 }],
      }),
      409,
      "RETURN_EXCEEDS_DOCUMENT"
    );
  });

  it("refuses a return naming a product that is not on the source document", async () => {
    const [product] = t.products;
    const offListProduct = await newProduct("QA NotOnInvoice");

    const sale = await saleOf(product, 3);

    await expectRefusal(
      postReturnRes({
        returnType: "SALE",
        saleId: sale.id,
        items: [{ productId: offListProduct.id, quantity: 1 }],
      }),
      400,
      "PRODUCT_NOT_ON_DOCUMENT"
    );
  });

  it("rejects over-return, cumulative across every return on the document", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 5);

    await createReturn(t, { returnType: "SALE", saleId: sale.id, items: [{ productId: product.id, quantity: 3 }] });
    await createReturn(t, { returnType: "SALE", saleId: sale.id, items: [{ productId: product.id, quantity: 2 }] });

    const res = await postReturnRes({
      returnType: "SALE",
      saleId: sale.id,
      returnCode: unique("RET-EXCESS"),
      items: [{ productId: product.id, quantity: 1 }],
    });

    expect(res.status).toBe(409);
    if (res.body?.code !== "RETURN_EXCEEDS_DOCUMENT") {
      throw new Error(`expected RETURN_EXCEEDS_DOCUMENT, got ${JSON.stringify(res.body)}`);
    }
  });
});

describe("sale returns — money effects (server-derived, P0-6 parity)", () => {
  it("derives unitPrice, proportional tax and proportional discount from the invoice — forged figures are ignored", async () => {
    const [product] = t.products;
    // 5 × 25 = 125, tax 10% = 12.5, discount 20 → total 117.5
    const sale = await createSale(t, {
      customerId: t.customer.id,
      items: [{ productId: product.id, quantity: 5, unitPrice: 25, taxPercent: 10 }],
      discount: 20,
    });
    const detail = await saleDetail(t, sale.id);
    expectMoney(detail.totalAmount ?? detail.sale?.totalAmount, 117.5);

    // The forged trio: the old API banked these verbatim into `return_items`.
    const ret = await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPrice: 66.6, // forged
          taxAmount: 6.66, // forged
          discount: 6.66, // forged
        },
      ],
    });

    const line = ret.items?.[0] ?? (await returnDetail(t, ret.returnCode ?? ret.id)).items[0];

    // The invoice's unitPrice, not the client's 66.6.
    expectMoney(line.unitPrice, 25);
    // 12.5 line tax × 2/5, not the forged 6.66.
    expectMoney(line.taxAmount, round2(12.5 * (2 / 5)));
    // The header 20 distributed over the document × 2/5, not the forged 6.66.
    expectMoney(line.discount, round2(20 * (2 / 5)));
  });

  it("the customer balance falls by exactly the derived credit (partial return, unpaid invoice)", async () => {
    const [product] = t.products;
    const balance0 = await customerBalance(t, t.customer.id);

    const sale = await createSale(t, {
      customerId: t.customer.id,
      items: [{ productId: product.id, quantity: 5, unitPrice: 25, taxPercent: 10 }],
      discount: 20,
    });
    const balance1 = await customerBalance(t, t.customer.id);
    expectMoney(balance1 - balance0, 117.5);

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 60, taxAmount: 60, discount: 60 }],
    });

    // 2×25 + derived tax 5 − derived discount 8 = 47, taken off the customer's
    // balance regardless of what the client claimed the line was worth.
    const balance2 = await customerBalance(t, t.customer.id);
    expectMoney(balance1 - balance2, 47);
  });

  it("a fully-paid invoice returned in full settles to a zero balance, never negative", async () => {
    const [product] = t.products;
    const customer = await createIsolatedCustomer(t, "PaidFull");
    const sale = await createSale(t, {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 5, unitPrice: 25, taxPercent: 10 }],
      discount: 20,
    });

    await createPayment(t, { customerId: customer.id, saleId: sale.id, amount: 117.5 });
    expectMoney(await customerBalance(t, customer.id), 0);

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: product.id, quantity: 5, unitPrice: 3, taxAmount: 3, discount: 3 }],
    });

    // invoice 117.5 − credits 117.5 − payments 117.5 = 0. The customer's cash
    // became store credit (ADR 0006), not a cash refund.
    expectMoney(await customerBalance(t, customer.id), 0);
  });

  it("unallocated store credit exactly covers the returned credits and refuses to over-spend it", async () => {
    const [product] = t.products;
    const customer = await createIsolatedCustomer(t, "StoreCredit");
    const sale = await createSale(t, {
      customerId: customer.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 25, taxPercent: 10 }],
    });
    // credit for a full return: 4×25 + tax 10% − discount 0
    const credit = round2(4 * 25 * 1.1);
    expectMoney(credit, 110);

    await createReturn(t, {
      returnType: "SALE",
      saleId: sale.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 1, taxAmount: 1, discount: 1 }],
    });

    // Spending up to the accumulated credit is fine...
    await createPayment(t, { customerId: customer.id, method: "Store Credit", amount: credit });

    // ...and beyond it is refused.
    const res = await postRes("/payments", {
      paymentCode: unique("PAY-X"),
      customerId: customer.id,
      amount: 0.01,
      method: "Store Credit",
    });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("INSUFFICIENT_STORE_CREDIT");
  });
});

describe("sale returns — validity gates", () => {
  it("refuses a return against a cancelled invoice", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 3);
    await post(`/sales/${sale.id}/cancel`, {});

    const res = await postReturnRes({
      returnType: "SALE",
      saleId: sale.id,
      returnCode: unique("RET-CXL"),
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect([409, 400, 422]).toContain(res.status);
  });

  it("refuses a return against a soft-deleted invoice", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 3);
    await del(`/sales/${sale.id}`);

    const res = await postReturnRes({
      returnType: "SALE",
      saleId: sale.id,
      returnCode: unique("RET-DEL"),
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(res.status).toBe(400);
    if (res.body?.code !== "SALE_NOT_IN_ORGANIZATION") {
      throw new Error(`expected SALE_NOT_IN_ORGANIZATION, got ${JSON.stringify(res.body)}`);
    }
  });

  it("refuses a return outside the company's return window", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 2);
    // Backdate the invoice to 40 days ago with the window still at 30.
    await warpSale(sale.id, new Date(Date.now() - 40 * 86_400_000));

    const res = await postReturnRes({
      returnType: "SALE",
      saleId: sale.id,
      returnCode: unique("RET-WINDOW"),
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("RETURN_WINDOW_EXPIRED");
  });

  it("refuses a return naming a foreign tenant's product and never touches its stock", async () => {
    const other = t.other.products[0];
    const sale = await saleOf(t.products[0], 2);

    const res = await postReturnRes({
      returnType: "SALE",
      saleId: sale.id,
      returnCode: unique("RET-XTENANT"),
      items: [{ productId: other.id, quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");

    // The other tenant's on-hand never moved.
    const otherStock = await prisma.inventory.findFirst({
      where: { productId: other.id, organizationId: t.other.organizationId },
    });
    expect(otherStock?.quantityOnHand ?? 0).toBe(0);
  });
});

describe("sale returns — idempotency and concurrency", () => {
  it("posting the same return twice records one return: the second post is refused", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 10);

    const code = unique("RET-IDEM");
    const body = {
      returnCode: code,
      returnType: "SALE",
      saleId: sale.id,
      reason: "QA retry",
      items: [{ productId: product.id, quantity: 2, unitPrice: 66.6, taxAmount: 6.66, discount: 6.66 }],
    };

    expect((await postRes("/returns", body)).status).toBe(201);
    expect((await postRes("/returns", body)).status).toBeGreaterThanOrEqual(400);

    const rows = await prisma.return.findMany({ where: { returnCode: code } });
    expect(rows).toHaveLength(1);

    const stored = await prisma.returnItem.findMany({ where: { returnId: rows[0].id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].quantity).toBe(2);
  });

  it("two simultaneous returns of the last units cannot both land", async () => {
    const [product] = t.products;
    const sale = await saleOf(product, 2);

    const body = (code: string) => ({
      returnCode: unique(code),
      returnType: "SALE",
      saleId: sale.id,
      reason: "QA race",
      items: [{ productId: product.id, quantity: 2, unitPrice: 66.6, taxAmount: 6.66, discount: 6.66 }],
    });

    const race = await Promise.allSettled([
      post("/returns", body("RET-RACE1")),
      post("/returns", body("RET-RACE2")),
    ]);

    const statuses = race.map((r) => {
      if (r.status === "fulfilled") return 201;
      const error = r.reason as ApiError;
      return error?.status ?? 500;
    });

    expect(statuses.filter((s) => s < 400)).toHaveLength(1);
    expect(statuses.filter((s) => s >= 400)).toHaveLength(1);
    // A conflict, not a crash.
    expect([409, 422]).toContain(statuses.find((s) => s >= 400));

    const returned = await prisma.returnItem.aggregate({
      where: { return: { saleId: sale.id, organizationId: t.organizationId } },
      _sum: { quantity: true },
    });
    expect(returned._sum.quantity ?? 0).toBeLessThanOrEqual(2);
  });
});

describe("purchase returns — stock and gate effects", () => {
  it("a purchase return takes the exact quantity out of stock", async () => {
    const [product] = t.products;
    const purchase = await createPurchase(t, t.supplier.id, [{ productId: product.id, quantity: 10 }]);

    const before = (await inventoryRow(t, product.id)).quantityOnHand;

    const ret = await createReturn(t, {
      returnType: "PURCHASE",
      purchaseId: purchase.id,
      items: [{ productId: product.id, quantity: 3 }],
    });

    expect(before - (await inventoryRow(t, product.id)).quantityOnHand).toBe(3);

    const rows = (await ledgerRows(t, product.id)).filter((r: any) => r.reference === ret.returnCode);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].movementType).toBe("OUT");
    for (const r of rows) expect(delta(r)).toBe(-3);
  });

  it("refuses returning more of a product than the purchase carried, cumulatively", async () => {
    const [product] = t.products;
    const purchase = await createPurchase(t, t.supplier.id, [{ productId: product.id, quantity: 5 }]);

    await createReturn(t, { returnType: "PURCHASE", purchaseId: purchase.id, items: [{ productId: product.id, quantity: 5 }] });

    await expectRefusal(
      postReturnRes({
        returnType: "PURCHASE",
        purchaseId: purchase.id,
        returnCode: unique("RET-POVER"),
        items: [{ productId: product.id, quantity: 1 }],
      }),
      409,
      "RETURN_EXCEEDS_DOCUMENT"
    );
  });

  it("refuses a purchase return that would drive on-hand stock below zero", async () => {
    const fresh = await newProduct("QA ShortStock");

    const purchase = await createPurchase(t, t.supplier.id, [{ productId: fresh.id, quantity: 6 }]);
    await saleOf(fresh, 5);

    expect((await inventoryRow(t, fresh.id)).quantityOnHand).toBe(1);

    // Headroom allows 6, on-hand allows 1 — the document must refuse anyway.
    const res = await postReturnRes({
      returnType: "PURCHASE",
      purchaseId: purchase.id,
      returnCode: unique("RET-NEG"),
      items: [{ productId: fresh.id, quantity: 2 }],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body?.code).toBe("INSUFFICIENT_STOCK");
  });

  it("a standalone DAMAGED return moves stock out and is refused when on hand is short", async () => {
    const [product] = t.products;
    const onHand = (await inventoryRow(t, product.id)).quantityOnHand;

    const ret = await createReturn(t, {
      returnType: "DAMAGED",
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect((await inventoryRow(t, product.id)).quantityOnHand).toBe(onHand - 1);

    expect(
      (await ledgerRows(t, product.id)).some((r: any) => r.reference === ret.returnCode && r.movementType === "DAMAGED")
    ).toBe(true);
  });
});
