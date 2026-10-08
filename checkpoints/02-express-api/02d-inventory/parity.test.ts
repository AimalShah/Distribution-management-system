/**
 * Checkpoint 2d — Inventory API: Parity Test
 *
 * Scope: two things in this service that exist *only* because there is a real
 * database behind it.
 *
 * **1. The low-stock filter is a column-to-column comparison.** `getLowStock`
 * builds `where: { quantityOnHand: { lte: prisma.inventory.fields.reorderLevel } }`.
 * Prisma compiles a field reference to a SQL fragment the database evaluates
 * against the row it is reading, so this genuinely compares two columns of the
 * same row. There is no way to fake that against a mock -- a mocked `findMany`
 * returns whatever it was told to, so a test here can only be checking that the
 * query object was spelled correctly. The interesting cases are a row exactly at
 * the reorder level, one below it, and one above, for two products whose reorder
 * levels differ, in two tenants. Every one of those is a distinct answer the
 * database has to produce.
 *
 * **2. `InventoryLog` has no `organizationId` column.** The tenant is reached
 * through `product -> Product.organizationId`, so the log list scopes with
 * `where: { product: { organizationId } }`. `source-review.md` records that the
 * checkpoint plan's `where: { organizationId }` on the log model "would be
 * rejected by Prisma". That relation hop is the reason a real second tenant's
 * log rows are the only way to show the filter is load-bearing.
 *
 * The movement taxonomy is pinned alongside. A log's `quantity` is a *magnitude*
 * for IN/OUT/RETURN/DAMAGED/EXPIRED, and *signed* for ADJUSTMENT, where it is the
 * difference a physical count found. The legacy service hid two defects behind
 * `Math.max(0, newQty)`: ADJUSTMENT and TRANSFER set an absolute figure but logged
 * `quantity` as if it were the amount moved, and DAMAGED/EXPIRED clamped at zero
 * so writing off 10 of 5 recorded a movement of 10 for a change of 5.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
  asUser,
  errorBody,
  hasDatabase,
  orgOnly,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

describe.skipIf(!hasDatabase)("Checkpoint 2d — Inventory API", () => {
  let t: Tenant;

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const product = () =>
    prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: t.organizationId,
        name: "Parity stock item",
        categoryId: t.categoryId,
        brandId: t.brandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 2,
      },
    });

  /**
   * A stock row for a fresh product.
   *
   * The organization is the first argument and has no default on purpose: a
   * "theirs" row silently created in the caller's own tenant reads as a tenant
   * leak when the assertion fails, and reads as a broken filter when it is the
   * test that is wrong.
   */
  const stocked = async (org: string, onHand: number, reorderLevel: number) => {
    const mine = org === t.organizationId;

    const p = await prisma.product.create({
      data: {
        productCode: unique("SKU"),
        organizationId: org,
        name: "Stocked for parity",
        categoryId: mine ? t.categoryId : t.otherCategoryId,
        brandId: mine ? t.brandId : t.otherBrandId,
        unit: "pcs",
        unitCost: 1,
        unitPrice: 2,
      },
    });

    const row = await prisma.inventory.create({
      data: { productId: p.id, organizationId: org, quantityOnHand: onHand, reorderLevel },
    });

    return row;
  };

  const adjust = (
    inventoryId: string,
    movementType: string,
    quantity: number,
    userId: string | null = t.userId,
    reason = "parity suite"
  ) => {
    const req = request(app)
      .post("/api/inventory/adjust")
      .send({ inventoryId, movementType, quantity, reason });

    return (userId
      ? req.set(asUser(t.organizationId, userId))
      : req.set(orgOnly(t.organizationId))
    );
  };

  it("compares quantity on hand against each row's own reorder level", async () => {
    // The point of the whole suite. `quantityOnHand <= reorderLevel`, evaluated per
    // row, so a single fixed threshold would get the last two of these wrong.
    const atThreshold = await stocked(t.organizationId, 5, 5);
    const below = await stocked(t.organizationId, 2, 10);
    const above = await stocked(t.organizationId, 11, 10);
    const healthy = await stocked(t.organizationId, 50, 10);

    const res = await request(app).get("/api/inventory/low-stock").set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    const ids = res.body.data.map((r: { id: string }) => r.id);

    // `lte` is inclusive, so a row sitting exactly on its reorder level is low.
    expect(ids).toContain(atThreshold.id);
    expect(ids).toContain(below.id);
    expect(ids).not.toContain(above.id);
    expect(ids).not.toContain(healthy.id);

    // Ordered by quantityOnHand asc, so the most urgent row leads.
    const quantities = res.body.data.map((r: { quantityOnHand: number }) => r.quantityOnHand);
    expect([...quantities].sort((a, b) => a - b)).toEqual(quantities);
  });

  it("keeps the low-stock filter inside the caller's tenant", async () => {
    // A field reference is still a `where` clause; it does not bypass the tenant
    // filter. A row one over its own level in another tenant must not appear just
    // because it is low by that tenant's threshold.
    const mine = await stocked(t.organizationId, 3, 10);
    const theirs = await stocked(t.otherOrganizationId, 1, 1);

    const res = await request(app).get("/api/inventory/low-stock").set(asOrg(t.organizationId));
    const ids = res.body.data.map((r: { id: string }) => r.id);

    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  it("reaches the log's tenant through the product relation", async () => {
    // `InventoryLog` has no `organizationId` of its own. The other tenant's log
    // row exists and is genuinely low-stock-relevant, so the only thing keeping it
    // out of this response is the relation filter.
    const mine = await stocked(t.organizationId, 10, 10);
    const theirs = await stocked(t.otherOrganizationId, 10, 10);
    await adjust(mine.id, "IN", 5).then(() => undefined);
    await prisma.inventoryLog.create({
      data: {
        inventoryId: theirs.id,
        productId: theirs.productId,
        userId: t.otherUserId,
        movementType: "IN",
        quantity: 5,
        previousQty: 0,
        newQty: 5,
      },
    });

    const res = await request(app).get("/api/inventory/logs").set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    const productIds = res.body.data.map((l: { productId: string }) => l.productId);
    expect(productIds).toContain(mine.productId);
    expect(productIds).not.toContain(theirs.productId);
    // And the log carries the two user columns it renders, not the whole row.
    expect(res.body.data[0].user).toHaveProperty("email");
  });

  it("logs a directional movement as a magnitude", async () => {
    // |previousQty - newQty| === quantity, for every type that carries direction
    // in `movementType` rather than in the sign.
    const row = await stocked(t.organizationId, 10, 5);

    await adjust(row.id, "IN", 5);
    await adjust(row.id, "DAMAGED", 2);
    await adjust(row.id, "RETURN", 1);
    await adjust(row.id, "EXPIRED", 1);

    const logs = await prisma.inventoryLog.findMany({
      where: { inventoryId: row.id },
      orderBy: { createdAt: "asc" },
    });

    expect(logs.map((l) => [l.movementType, l.quantity, l.previousQty, l.newQty])).toEqual([
      ["IN", 5, 10, 15],
      ["DAMAGED", 2, 15, 13],
      ["RETURN", 1, 13, 14],
      ["EXPIRED", 1, 14, 13],
    ]);
    // The stored quantity is never negative, even though these all reduce stock.
    expect(logs.every((l) => l.quantity >= 0)).toBe(true);
  });

  it("logs an adjustment as the signed difference a count found", async () => {
    // A count is an absolute figure, and the log records what it changed. So
    // previousQty + quantity === newQty here, and the sign follows the direction
    // of the correction.
    const row = await stocked(t.organizationId, 20, 5);

    const down = await adjust(row.id, "ADJUSTMENT", 8);
    expect(down.status).toBe(200);
    expect(down.body.quantityOnHand).toBe(8);

    const up = await adjust(row.id, "ADJUSTMENT", 15);
    expect(up.body.quantityOnHand).toBe(15);

    const logs = await prisma.inventoryLog.findMany({
      where: { inventoryId: row.id, movementType: "ADJUSTMENT" },
      orderBy: { createdAt: "asc" },
    });

    // The legacy service set the absolute figure but logged `quantity` unchanged,
    // so a change of 12 was recorded as "moved 15" and no longer added up.
    expect(logs.map((l) => [l.previousQty, l.quantity, l.newQty])).toEqual([
      [20, -12, 8],
      [8, 7, 15],
    ]);
  });

  it("accepts a count of zero, but refuses a directional movement of zero", async () => {
    // A physical count can legitimately find no stock. A movement of nothing is
    // not a movement.
    const row = await stocked(t.organizationId, 10, 5);

    const counted = await adjust(row.id, "ADJUSTMENT", 0);
    expect(counted.status).toBe(200);
    expect(counted.body.quantityOnHand).toBe(0);

    const moved = await adjust(row.id, "IN", 0);
    expect(moved.status).toBe(400);
    expect(moved.body).toMatchObject({ code: "QUANTITY_MUST_BE_POSITIVE" });
  });

  it("refuses a transfer, which this schema cannot express", async () => {
    // There is one `Inventory` row per product and no destination or location
    // column. The legacy service treated TRANSFER as an absolute set, so it
    // silently rewrote the quantity. Refused before any row is read or written.
    const row = await stocked(t.organizationId, 10, 5);

    const res = await adjust(row.id, "TRANSFER", 3);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "UNSUPPORTED_MOVEMENT" });
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: row.id } })).quantityOnHand
    ).toBe(10);
  });

  it("refuses to write off more than is in stock, and writes nothing", async () => {
    // The legacy `Math.max(0, newQty)` clamped here, recording a movement of 10
    // against a change of 5 and losing the shortfall entirely.
    const row = await stocked(t.organizationId, 5, 5);

    const res = await adjust(row.id, "DAMAGED", 10);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(res.body.details).toMatchObject({ available: 5, requested: 10 });

    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: row.id } })).quantityOnHand).toBe(5);
    expect(await prisma.inventoryLog.count({ where: { inventoryId: row.id } })).toBe(0);
  });

  it("rolls the movement back when the ledger write fails", async () => {
    // The stock change is applied first and the log second, inside one
    // transaction. A reference the database cannot store trips the ledger insert
    // after the decrement has already landed -- the only way to see whether the
    // decrement survives. A mocked suite cannot ask that question: there is no
    // rollback to mock.
    const row = await stocked(t.organizationId, 10, 5);

    const res = await adjust(row.id, "OUT", 4, t.userId, "parity\u0000suite");

    // An untranslatable column-range failure: see 02b for why the status is not
    // what this assertion is for.
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: "INTERNAL_ERROR" });

    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: row.id } })).quantityOnHand).toBe(10);
    expect(await prisma.inventoryLog.count({ where: { inventoryId: row.id } })).toBe(0);
  });

  it("requires a user header, because every movement is logged", async () => {
    const row = await stocked(t.organizationId, 10, 5);
    const res = await adjust(row.id, "IN", 1, null);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "USER_REQUIRED" });
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: row.id } })).quantityOnHand).toBe(10);
  });

  it("refuses to attach a stock row to another tenant's product", async () => {
    // `Inventory.productId` is `@unique` across the whole table, so without this
    // check the create would succeed and hang another company's product off this
    // tenant's stock row.
    const res = await request(app)
      .post("/api/inventory")
      .set(asOrg(t.organizationId))
      .send({ productId: t.otherProductId, quantityOnHand: 100 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "PRODUCT_NOT_IN_ORGANIZATION" });
    expect(await prisma.inventory.findUnique({ where: { productId: t.otherProductId } })).toBeNull();
  });

  it("keeps an explicit zero on the stock levels", async () => {
    // `value || 0` on write turned a deliberate 0 into the default, and a `null`
    // maximum into `null` -- so a shelf with a hard cap of zero was stored as "no
    // cap". `??` keeps the zero.
    const p = await product();

    const res = await request(app)
      .post("/api/inventory")
      .set(asOrg(t.organizationId))
      .send({
        productId: p.id,
        quantityOnHand: 0,
        quantityReserved: 0,
        reorderLevel: 0,
        maxStockLevel: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      quantityOnHand: 0,
      quantityReserved: 0,
      reorderLevel: 0,
      maxStockLevel: 0,
    });

    // Creating with stock writes no opening log. The audit trail starts at the
    // first adjustment -- a parity decision, not an oversight, so it is pinned.
    expect(await prisma.inventoryLog.count({ where: { productId: p.id } })).toBe(0);
  });

  it("404s an adjustment against another tenant's stock record", async () => {
    const theirs = await stocked(t.otherOrganizationId, 10, 5);

    const res = await adjust(theirs.id, "IN", 1);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "INVENTORY_NOT_FOUND" });
  });

  it("404s a settings update against a foreign id", async () => {
    const theirs = await stocked(t.otherOrganizationId, 10, 5);

    const res = await request(app)
      .put(`/api/inventory/${theirs.id}/settings`)
      .set(asOrg(t.organizationId))
      .send({ reorderLevel: 99 });

    expect(res.status).toBe(404);
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: theirs.id } })).reorderLevel
    ).toBe(5);
  });

  it("rejects a settings call that changes nothing", async () => {
    const row = await stocked(t.organizationId, 10, 5);

    const res = await request(app)
      .put(`/api/inventory/${row.id}/settings`)
      .set(asOrg(t.organizationId))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.validation);
  });

  it("counts logs on the list instead of embedding them", async () => {
    const row = await stocked(t.organizationId, 10, 5);
    await adjust(row.id, "IN", 2);

    const res = await request(app).get("/api/inventory").set(asOrg(t.organizationId));
    const entry = res.body.data.find((r: { id: string }) => r.id === row.id);

    expect(entry._count.logs).toBe(1);
    expect(entry.logs).toBeUndefined();
  });

  it("routes /logs and /low-stock ahead of /:id", async () => {
    // Mounted the other way round, "logs" parses as an inventory id.
    for (const path of ["/api/inventory/logs", "/api/inventory/low-stock"]) {
      const res = await request(app).get(path).set(asOrg(t.organizationId));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
    }
  });

  it("requires an organization header", async () => {
    const res = await request(app).get("/api/inventory");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.organizationRequired);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2d — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
