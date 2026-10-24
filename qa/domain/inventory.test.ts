/**
 * Domain correctness of inventory, adjustments, and bulk import (Phase 2).
 *
 * This suite pins inventory tracking and the movement ledger invariants:
 *
 *   opening count — POST /api/inventory establishes opening count on hand and
 *                   writes the initial InventoryLog row.
 *   adjustments   — POST /api/inventory/adjust handles IN, OUT, and absolute count
 *                   adjustments; OUT is guarded against driving stock negative;
 *                   every adjustment records an InventoryLog with previous/new balance.
 *   bulk import   — POST /api/inventory/bulk-import imports inventory rows in bulk;
 *                   crucially (flag F-13), every imported row MUST produce an
 *                   InventoryLog movement row so the movement ledger reconciles.
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";

import prisma from "@dms/db";
import {
  ApiError,
  api,
  expectRefusal,
  inventoryRow,
  ledgerRows,
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
  t = await seedTenant(10);
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

  return res.body as { id: string; productCode: string };
};

/* -------------------------------------------------------------------------- */

describe("inventory — opening stock & settings", () => {
  it("POST /api/inventory establishes opening stock and logs an IN movement row with reference OPENING", async () => {
    const p = await newProduct("inv-opening");

    const created = await expectOk(
      raw("post", "/inventory", {
        productId: p.id,
        quantityOnHand: 35,
        reorderLevel: 5,
        maxStockLevel: 100,
      })
    );

    expect(created.body.quantityOnHand).toBe(35);
    expect(created.body.reorderLevel).toBe(5);

    // Ledger has the opening row
    const logs = await ledgerRows(t, p.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const openLog = logs.find((l) => l.reference === "OPENING");
    expect(openLog).toBeDefined();
    expect(openLog.movementType).toBe("IN");
    expect(openLog.quantity).toBe(35);
    expect(openLog.newQty).toBe(35);
  });

  it("PUT /api/inventory/:id/settings updates reorder and max stock thresholds without moving stock", async () => {
    const p = await newProduct("inv-settings");
    const inv = await seedStock(t, p as any, 20);

    const updated = await expectOk(
      raw("put", `/inventory/${inv.id}/settings`, {
        reorderLevel: 8,
        maxStockLevel: 50,
      })
    );

    expect(updated.body.reorderLevel).toBe(8);
    expect(updated.body.maxStockLevel).toBe(50);

    // Quantity on hand stays exactly 20
    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(20);
  });
});

describe("inventory — adjustments", () => {
  it("ADJUSTMENT with IN direction increases stock and logs the movement", async () => {
    const p = await newProduct("inv-adj-in");
    const inv = await seedStock(t, p as any, 10);

    await expectOk(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "IN",
        quantity: 15,
        reason: "Stock arrival audit",
      })
    );

    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(25);

    const logs = await ledgerRows(t, p.id);
    const adjLog = logs.find((l) => l.reason === "Stock arrival audit");
    expect(adjLog).toBeDefined();
    expect(adjLog.movementType).toBe("IN");
    expect(adjLog.quantity).toBe(15);
    expect(adjLog.newQty).toBe(25);
  });

  it("ADJUSTMENT with OUT direction is guarded against negative stock", async () => {
    const p = await newProduct("inv-adj-out");
    const inv = await seedStock(t, p as any, 10);

    // Out of 15 when only 10 on hand -> must refuse
    const res = await raw("post", "/inventory/adjust", {
      inventoryId: inv.id,
      movementType: "OUT",
      quantity: 15,
      reason: "Damaged goods",
    });

    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("INSUFFICIENT_STOCK");

    // Stock stays 10
    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(10);
  });

  it("ADJUSTMENT with count (absolute) sets the level and computes signed delta", async () => {
    const p = await newProduct("inv-adj-count");
    const inv = await seedStock(t, p as any, 20);

    // Absolute count set to 12 (loss of 8)
    await expectOk(
      raw("post", "/inventory/adjust", {
        inventoryId: inv.id,
        movementType: "ADJUSTMENT",
        quantity: 12,
        reason: "Physical count recount",
      })
    );

    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(12);

    const logs = await ledgerRows(t, p.id);
    const recountLog = logs.find((l) => l.reason === "Physical count recount");
    expect(recountLog).toBeDefined();
    expect(recountLog.previousQty).toBe(20);
    expect(recountLog.newQty).toBe(12);
  });

  it("ADJUSTMENT with TRANSFER is rejected as unsupported", async () => {
    const p = await newProduct("inv-adj-xfer");
    const inv = await seedStock(t, p as any, 20);

    const res = await raw("post", "/inventory/adjust", {
      inventoryId: inv.id,
      movementType: "TRANSFER",
      quantity: 5,
      reason: "Location transfer attempt",
    });

    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("UNSUPPORTED_MOVEMENT");
  });
});

describe("inventory — bulk CSV import (F-13)", () => {
  it("bulk import creates new inventory records AND writes InventoryLog movement rows (F-13)", async () => {
    const p = await newProduct("bulk-new");

    // Product has NO inventory record
    const res = await expectOk(
      raw("post", "/inventory/bulk-import", [
        {
          productCode: p.productCode,
          quantityOnHand: 45,
          reorderLevel: 10,
          maxStockLevel: 100,
        },
      ])
    );

    expect(res.body.created).toBe(1);
    expect(res.body.errors).toHaveLength(0);

    // Inventory record exists and has 45 units
    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(45);

    // CRITICAL (F-13): An InventoryLog movement row MUST have been written for reconciliation
    const logs = await ledgerRows(t, p.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const importLog = logs.find((l) => l.reason === "Bulk inventory import");
    expect(importLog).toBeDefined();
    expect(importLog.movementType).toBe("ADJUSTMENT");
    expect(importLog.newQty).toBe(45);
  });

  it("bulk import updates existing inventory records AND writes InventoryLog movement rows (F-13)", async () => {
    const p = await newProduct("bulk-existing");
    await seedStock(t, p as any, 10);

    // Update quantityOnHand to 30 via bulk import
    const res = await expectOk(
      raw("post", "/inventory/bulk-import", [
        {
          productCode: p.productCode,
          quantityOnHand: 30,
        },
      ])
    );

    expect(res.body.updated).toBe(1);
    expect(res.body.errors).toHaveLength(0);

    const row = await inventoryRow(t, p.id);
    expect(row.quantityOnHand).toBe(30);

    // CRITICAL (F-13): An InventoryLog row MUST record the adjustment from 10 to 30
    const logs = await ledgerRows(t, p.id);
    const updateLog = logs.find(
      (l) => l.reason === "Bulk inventory import" && l.previousQty === 10 && l.newQty === 30
    );
    expect(updateLog).toBeDefined();
    expect(updateLog.movementType).toBe("ADJUSTMENT");
  });
});
