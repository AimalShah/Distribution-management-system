/**
 * Domain correctness of purchases & inventory intake (Phase 2).
 *
 * This suite pins the business operations, stock mutations, and guard gates for
 * the purchase lifecycle:
 *
 *   create — derives tax and total server-side, increments stock (opening the
 *            row if needed), upserts batch/lot records, logs an IN movement,
 *            and verifies customer/supplier/product tenancy.
 *   update — header columns only (discount recomputes total from stored lines),
 *            refuses foreign suppliers, leaves lines and stock untouched.
 *   delete — reverses the stock intake (guarded against negative stock if goods
 *            were already sold), guards against active returns, soft-deletes
 *            with `deletedAt` stamp (F-11 audit trail), and excludes deleted
 *            rows from subsequent reads.
 *
 * Pinned bugs / flags surfaced here:
 *   - F-3: `createPurchase` must verify `supplierId` is in-org (400 SUPPLIER_NOT_IN_ORGANIZATION)
 *   - F-11: `deletePurchase` must soft-delete (stamp `deletedAt`), not hard-delete
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";

import prisma from "@dms/db";
import {
  ApiError,
  api,
  batchQuantities,
  createPurchase,
  createReturn,
  createSale,
  expectMoney,
  expectRefusal,
  inventoryRow,
  ledgerRows,
  purchaseDetail,
  round2,
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

const newProduct = async (name: string, unitCost = 10, unitPrice = 25) => {
  const res = await expectOk(
    raw("post", "/products", {
      name: unique(name),
      category: t.categoryId,
      brand: t.brandId,
      unit: "piece",
      unitCost,
      unitPrice,
      gstApplicable: true,
      gstRate: 10,
      isActive: true,
    })
  );

  return res.body as { id: string };
};

const makePurchase = (draft: {
  supplierId: string;
  items: { productId: string; quantity: number; unitCost?: number; taxPercent?: number; batchNumber?: string; expiryDate?: string }[];
  discount?: number;
  status?: string;
}) =>
  raw("post", "/purchases", {
    purchaseCode: unique("PO"),
    supplierId: draft.supplierId,
    purchaseDate: new Date().toISOString(),
    status: draft.status ?? "Received",
    discount: draft.discount ?? 0,
    items: draft.items.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost ?? 10,
      taxPercent: line.taxPercent ?? 10,
      itemDiscount: 0,
      batchNumber: line.batchNumber ?? null,
      expiryDate: line.expiryDate ?? null,
    })),
  });

/* -------------------------------------------------------------------------- */

describe("purchases — create & stock intake", () => {
  it("stock increases by the purchased quantity, opening inventory if none existed", async () => {
    const p = await newProduct("po-stock-in");
    // Product has no inventory row yet
    const purchase = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 25, unitCost: 12 }]);

    expect(purchase.id).toBeDefined();

    // Inventory row was created and has 25 units
    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(25);

    // Ledger has an IN movement row
    const logs = await ledgerRows(t, p.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const inLog = logs.find((l) => l.movementType === "IN");
    expect(inLog).toBeDefined();
    expect(inLog.quantity).toBe(25);
    expect(inLog.newQty - inLog.previousQty).toBe(25);
  });

  it("server derives totals and taxes from lines, ignoring client money fields", async () => {
    const p1 = await newProduct("po-tax-1", 10);
    const p2 = await newProduct("po-tax-2", 20);

    // 10 units of $10 at 10% tax = $100 gross + $10 tax = $110
    // 5 units of $20 at 5% tax   = $100 gross + $5 tax  = $105
    // Header discount: $15
    // Expected total: (100 + 10) + (100 + 5) - 15 = $200
    // Expected taxAmount: 10 + 5 = 15
    const res = await expectOk(
      raw("post", "/purchases", {
        purchaseCode: unique("PO"),
        supplierId: t.supplier.id,
        purchaseDate: new Date().toISOString(),
        status: "Received",
        discount: 15,
        totalAmount: 9999, // client forged figure — must be ignored
        taxAmount: 9999,   // client forged figure — must be ignored
        items: [
          { productId: p1.id, quantity: 10, unitCost: 10, taxPercent: 10, itemDiscount: 0 },
          { productId: p2.id, quantity: 5, unitCost: 20, taxPercent: 5, itemDiscount: 0 },
        ],
      })
    );

    expectMoney(res.body.totalAmount, 200);
    expectMoney(res.body.taxAmount, 15);
  });

  it("batches upsert with expiry date and quantityRemaining tracking", async () => {
    const p = await newProduct("po-batch");
    const batchNum = unique("BATCH");
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 40, unitCost: 15 }], {
      batchNumber: batchNum,
      expiryDate: expiry,
    });

    const batches = await batchQuantities(t, p.id);
    const found = batches.find((b) => b.batchNumber === batchNum);
    expect(found).toBeDefined();
    expect(found?.quantityRemaining).toBe(40);
  });

  it("refuses a negative total with INVALID_TOTAL", async () => {
    const p = await newProduct("po-neg");

    const res = await raw("post", "/purchases", {
      purchaseCode: unique("PO"),
      supplierId: t.supplier.id,
      purchaseDate: new Date().toISOString(),
      status: "Received",
      discount: 500, // exceeds line subtotal
      items: [{ productId: p.id, quantity: 2, unitCost: 10, taxPercent: 10 }],
    });

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("INVALID_TOTAL");
  });

  it("refuses a product from another organization with PRODUCT_NOT_IN_ORGANIZATION", async () => {
    const foreignProduct = t.other.products[0];

    const res = await raw("post", "/purchases", {
      purchaseCode: unique("PO"),
      supplierId: t.supplier.id,
      purchaseDate: new Date().toISOString(),
      status: "Received",
      items: [{ productId: foreignProduct.id, quantity: 5, unitCost: 10 }],
    });

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("PRODUCT_NOT_IN_ORGANIZATION");
  });

  it("refuses a supplier from another organization with SUPPLIER_NOT_IN_ORGANIZATION (F-3)", async () => {
    const p = await newProduct("po-foreign-sup");
    const foreignSupplier = t.other.supplier;

    const res = await raw("post", "/purchases", {
      purchaseCode: unique("PO"),
      supplierId: foreignSupplier.id,
      purchaseDate: new Date().toISOString(),
      status: "Received",
      items: [{ productId: p.id, quantity: 5, unitCost: 10 }],
    });

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("SUPPLIER_NOT_IN_ORGANIZATION");
  });
});

describe("purchases — update semantics", () => {
  it("updating discount recomputes totalAmount from stored lines", async () => {
    const p = await newProduct("po-upd-disc", 20);
    // 5 units × 20 + 10% tax = $110, discount 0
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 5, unitCost: 20, taxPercent: 10 }]);
    expectMoney((await purchaseDetail(t, po.id)).totalAmount, 110);

    // Update discount to $20
    const updated = await expectOk(raw("put", `/purchases/${po.id}`, { discount: 20 }));
    expectMoney(updated.body.totalAmount, 90);
  });

  it("updating supplier verifies supplier belongs to the organization", async () => {
    const p = await newProduct("po-upd-sup");
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 2, unitCost: 10 }]);

    const res = await raw("put", `/purchases/${po.id}`, { supplierId: t.other.supplier.id });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("SUPPLIER_NOT_IN_ORGANIZATION");
  });

  it("header updates leave stock and item quantities untouched", async () => {
    const p = await newProduct("po-upd-stock", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 15, unitCost: 10 }]);

    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(15);

    await expectOk(raw("put", `/purchases/${po.id}`, { discount: 5, status: "Completed" }));

    // Stock stays exactly 15
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(15);
  });
});

describe("purchases — delete & soft-delete semantics (F-11)", () => {
  it("delete reverses stock and writes an OUT movement in the inventory log", async () => {
    const p = await newProduct("po-del-stock", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 12, unitCost: 10 }]);

    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(12);

    await expectOk(raw("delete", `/purchases/${po.id}`));

    // Stock reversed back to 0
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(0);

    // Log contains the reversal OUT movement
    const logs = await ledgerRows(t, p.id);
    const outLog = logs.find((l) => l.movementType === "OUT" && l.reference === po.purchaseCode);
    expect(outLog).toBeDefined();
    expect(outLog.quantity).toBe(12);
  });

  it("delete is refused when goods have been sold downstream (INSUFFICIENT_STOCK)", async () => {
    const p = await newProduct("po-del-insuf", 10, 25);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 10, unitCost: 10 }]);

    // Customer buys 6 units -> 4 remaining
    await createSale(t, { customerId: t.customer.id, items: [{ productId: p.id, quantity: 6 }] });
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(4);

    // Attempting to delete the purchase of 10 must be refused
    const res = await raw("delete", `/purchases/${po.id}`);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("INSUFFICIENT_STOCK");

    // Stock untouched
    expect((await inventoryRow(t, p.id)).quantityOnHand).toBe(4);
  });

  it("delete is refused when active returns exist against the purchase (PURCHASE_HAS_RETURNS)", async () => {
    const p = await newProduct("po-del-ret", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 10, unitCost: 10 }]);

    // Return 2 units to the supplier
    await createReturn(t, {
      returnType: "PURCHASE",
      purchaseId: po.id,
      items: [{ productId: p.id, quantity: 2 }],
    });

    // Deleting the purchase must be refused because a return is tied to it
    const res = await raw("delete", `/purchases/${po.id}`);
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("PURCHASE_HAS_RETURNS");
  });

  it("delete stamps deletedAt and preserves the row for audit trail (F-11)", async () => {
    const p = await newProduct("po-del-soft", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 5, unitCost: 10 }]);

    await expectOk(raw("delete", `/purchases/${po.id}`));

    // The row MUST still exist in the database with deletedAt stamped (not hard deleted)
    const row = await prisma.purchase.findUnique({ where: { id: po.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.deletedAt instanceof Date).toBe(true);
  });

  it("deleted purchases are excluded from get and list routes", async () => {
    const p = await newProduct("po-del-excl", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 5, unitCost: 10 }]);

    await expectOk(raw("delete", `/purchases/${po.id}`));

    // GET /purchases/:id returns 404
    const getRes = await raw("get", `/purchases/${po.id}`);
    expect(getRes.status).toBe(404);

    // GET /purchases excludes it from the list
    const listRes = await expectOk(raw("get", `/purchases?pageSize=100`));
    const items = listRes.body?.data ?? listRes.body;
    expect(items.find((item: { id: string }) => item.id === po.id)).toBeUndefined();
  });

  it("deleting an already deleted purchase returns 404 PURCHASE_NOT_FOUND", async () => {
    const p = await newProduct("po-del-twice", 10);
    const po = await createPurchase(t, t.supplier.id, [{ productId: p.id, quantity: 5, unitCost: 10 }]);

    await expectOk(raw("delete", `/purchases/${po.id}`));

    const second = await raw("delete", `/purchases/${po.id}`);
    expect(second.status).toBe(404);
    expect(second.body?.code).toBe("PURCHASE_NOT_FOUND");
  });
});
