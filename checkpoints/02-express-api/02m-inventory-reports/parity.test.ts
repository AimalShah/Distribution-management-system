/**
 * Checkpoint 2m — Inventory Reports API: Parity Test
 *
 * Five reports and a combined one, all of which the legacy computed without an
 * organization at all. Every assertion here that mentions a tenant is the reason
 * this file exists: a report can be correct in isolation and still hand one
 * install's stock, movements and purchase history to another, and the only way to
 * catch that is to put two tenants' rows in a real database and ask for one of
 * them.
 *
 * The second reason is arithmetic that has to come out of the database rather
 * than out of a fixture. The legacy `totalQuantity` was
 * `inventoryLog.groupBy(_sum: { quantity })` — a sum of movement magnitudes, so
 * goods arriving and goods leaving both pushed it up — and the valuation report
 * multiplied that by an average unit cost. These tests assert the numbers a
 * correct implementation has to produce, from rows whose sums are deliberately
 * different from their balances.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

describe.skipIf(!hasDatabase)("Checkpoint 2m — Inventory Reports API", () => {
  let t: Tenant;

  /** Product ids created here, so nothing depends on the seed's single product. */
  const products: Record<string, string> = {};
  /** The other tenant's products, kept apart so a scoping assertion cannot read a
   * `Record` miss as an absent row. */
  const otherProducts: Record<string, string> = {};
  /** Inventory rows, keyed by the same labels. */
  const inventory: Record<string, string> = {};

  /**
   * Fixture instants, held here rather than recomputed in each test.
   *
   * `daysAgo(35)` evaluated twice is two different instants a few milliseconds
   * apart, so an assertion comparing a stored `purchaseDate` against a freshly
   * computed one fails for a reason that has nothing to do with the report.
   */
  const cogCheapDate = daysAgo(45);
  const cogDearDate = daysAgo(35);
  const windowStart = daysAgo(90);
  const windowEnd = daysAgo(60);

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    // Everything was created inside a seeded tenant, so the shared teardown
    // reaches it: products by organization, and the purchases and inventory
    // rows leaf-first before them.
    if (t) await teardownTenants(t);
  });

  /**
   * A product with its inventory row, both owned by `orgId`.
   *
   * `Inventory.productId` is unique on its own — one stock row per product, not
   * per tenant — so a product and its inventory row are created together or not
   * at all.
   */
  const makeProduct = async (
    label: string,
    {
      orgId,
      unitCost,
      onHand = 0,
      reorderLevel = 0,
      maxStockLevel = null as number | null,
      brandId,
    }: {
      orgId: string;
      unitCost: number;
      onHand?: number;
      reorderLevel?: number;
      maxStockLevel?: number | null;
      brandId?: string;
    }
  ) => {
    const productId = `prd_${unique(label)}`;
    const mine = orgId === t.organizationId;
    await prisma.product.create({
      data: {
        id: productId,
        productCode: unique("SKU"),
        organizationId: orgId,
        name: label,
        unit: "pcs",
        unitCost,
        unitPrice: unitCost * 2,
        // `Product.category` and `Product.brand` are both required, and a brand
        // reaches its tenant through its own category — so each side takes the
        // pair the seed made for it.
        categoryId: mine ? t.categoryId : t.otherCategoryId,
        brandId: brandId ?? (mine ? t.brandId : t.otherBrandId),
      },
    });

    const row = await prisma.inventory.create({
      data: {
        id: `inv_${unique("inv")}`,
        productId,
        organizationId: orgId,
        quantityOnHand: onHand,
        reorderLevel,
        maxStockLevel,
      },
      select: { id: true },
    });

    if (mine) {
      products[label] = productId;
      inventory[label] = row.id;
    } else {
      otherProducts[label] = productId;
    }

    return productId;
  };

  const log = async (
    label: string,
    {
      productId,
      inventoryId,
      movementType,
      quantity,
      previousQty,
      newQty,
      createdAt,
      userId,
    }: {
      productId: string;
      inventoryId: string;
      movementType:
        | "IN"
        | "OUT"
        | "ADJUSTMENT"
        | "TRANSFER"
        | "RETURN"
        | "DAMAGED"
        | "EXPIRED";
      quantity: number;
      previousQty: number;
      newQty: number;
      createdAt: Date;
      userId: string;
    }
  ) => {
    await prisma.inventoryLog.create({
      data: {
        id: `log_${unique(label)}`,
        inventoryId,
        productId,
        userId,
        movementType,
        quantity,
        previousQty,
        newQty,
        createdAt,
      },
    });
  };

  const makePurchase = async (
    label: string,
    {
      orgId,
      supplierId,
      purchaseDate,
      items,
    }: {
      orgId: string;
      supplierId: string;
      purchaseDate: Date;
      items: {
        productId: string;
        quantity: number;
        unitCost: number;
        expiryDate?: Date | null;
        batchNumber?: string | null;
      }[];
    }
  ) => {
    const purchaseId = `pur_${unique(label)}`;
    await prisma.purchase.create({
      data: {
        id: purchaseId,
        purchaseCode: unique("PO"),
        organizationId: orgId,
        supplierId,
        totalAmount: items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
        status: "Completed",
        purchaseDate,
        createdAt: purchaseDate,
      },
    });

    for (const item of items) {
      await prisma.purchaseItem.create({
        data: {
          id: `pit_${unique("item")}`,
          purchaseId,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
          batchNumber: item.batchNumber ?? null,
          expiryDate: item.expiryDate ?? null,
        },
      });
    }

    return purchaseId;
  };

  const basic = (orgId: string, query = "") =>
    request(app).get(`/api/reports/inventory/basic${query}`).set(asOrg(orgId));

  const movements = (orgId: string, query = "") =>
    request(app).get(`/api/reports/inventory/movements${query}`).set(asOrg(orgId));

  const lowStock = (orgId: string, query = "") =>
    request(app).get(`/api/reports/inventory/low-stock${query}`).set(asOrg(orgId));

  const valuation = (orgId: string, query = "") =>
    request(app)
      .get(`/api/reports/inventory/stock-valuation${query}`)
      .set(asOrg(orgId));

  const expiry = (orgId: string, query = "") =>
    request(app).get(`/api/reports/inventory/expiry${query}`).set(asOrg(orgId));

  const full = (orgId: string, query = "") =>
    request(app).get(`/api/reports/inventory/full${query}`).set(asOrg(orgId));

  /**
   * The fixture is built once, in `beforeAll`, because every report reads the same
   * rows and each test would otherwise be asserting against a moving target.
   *
   * The important shape is `moving`: it received 100 and shipped 40, so the sum of
   * its movement magnitudes is 140 while its stock is 60. Any report that adds the
   * log up instead of reading the balance answers 140, which is what the legacy
   * did and what a stubbed test cannot distinguish from a correct answer.
   */
  beforeAll(async () => {
    const mine = t.organizationId;

    // Stock of 60 reached by receiving 100 and shipping 40.
    const moving = await makeProduct("moving", {
      orgId: mine,
      unitCost: 5,
      onHand: 60,
      reorderLevel: 10,
      maxStockLevel: 100,
    });

    await log("in100", {
      productId: moving,
      inventoryId: inventory.moving,
      movementType: "IN",
      quantity: 100,
      previousQty: 0,
      newQty: 100,
      createdAt: daysAgo(40),
      userId: t.userId,
    });
    await log("out40", {
      productId: moving,
      inventoryId: inventory.moving,
      movementType: "OUT",
      quantity: 40,
      previousQty: 100,
      newQty: 60,
      createdAt: daysAgo(30),
      userId: t.userId,
    });
    // An adjustment is signed: a physical count found three fewer than expected.
    await log("adj-3", {
      productId: moving,
      inventoryId: inventory.moving,
      movementType: "ADJUSTMENT",
      quantity: -3,
      previousQty: 60,
      newQty: 57,
      createdAt: daysAgo(20),
      userId: t.userId,
    });
    await log("dmg2", {
      productId: moving,
      inventoryId: inventory.moving,
      movementType: "DAMAGED",
      quantity: 2,
      previousQty: 57,
      newQty: 55,
      createdAt: daysAgo(10),
      userId: t.userId,
    });

    // Exactly at its reorder level, which counts as low: the comparison is `<=`.
    await makeProduct("atlevel", {
      orgId: mine,
      unitCost: 20,
      onHand: 5,
      reorderLevel: 5,
    });

    // A reorder level of zero means "do not reorder this", and `onHand: 0` is
    // `<= 0`. With a plain `lte` this product is reported as low on stock forever,
    // having never been below anything.
    await makeProduct("nolevel", { orgId: mine, unitCost: 30, onHand: 0 });

    // Two products with the same stock and different reorder levels, which is what
    // makes the field-to-field comparison visible: a hard-coded threshold gets one
    // of these two wrong.
    await makeProduct("above-3", { orgId: mine, unitCost: 40, onHand: 4, reorderLevel: 3 });
    await makeProduct("below-9", { orgId: mine, unitCost: 50, onHand: 4, reorderLevel: 9 });

    // Bought at 4 and at 10, so the average is 7. Ten on hand is therefore 70 —
    // while the sum of the movement magnitudes below would be 100, and the legacy
    // would have valued that at 700. Its reorder level puts it in the low-stock
    // report too, which is what gives that report something with a purchase
    // history to name a supplier from.
    const cog = await makeProduct("cog", {
      orgId: mine,
      unitCost: 7,
      onHand: 10,
      reorderLevel: 20,
    });

    await log("cog-in100", {
      productId: cog,
      inventoryId: inventory.cog,
      movementType: "IN",
      quantity: 100,
      previousQty: 0,
      newQty: 100,
      createdAt: daysAgo(50),
      userId: t.userId,
    });
    await makePurchase("cog-cheap", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: cogCheapDate,
      items: [{ productId: cog, quantity: 10, unitCost: 4 }],
    });
    await makePurchase("cog-dear", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: cogDearDate,
      items: [{ productId: cog, quantity: 10, unitCost: 10 }],
    });

    // Expiry lives on the purchase line, so this report is about what was bought.
    const sprocket = await makeProduct("sprocket", { orgId: mine, unitCost: 2, onHand: 12 });
    await makePurchase("soon", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: daysAgo(5),
      items: [
        {
          productId: sprocket,
          quantity: 40,
          unitCost: 2,
          batchNumber: "B-SOON",
          expiryDate: daysAhead(10),
        },
      ],
    });
    await makePurchase("later", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: daysAgo(60),
      items: [
        {
          productId: sprocket,
          quantity: 15,
          unitCost: 2,
          batchNumber: "B-LATER",
          expiryDate: daysAhead(90),
        },
      ],
    });
    await makePurchase("already", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: daysAgo(200),
      items: [
        {
          productId: sprocket,
          quantity: 7,
          unitCost: 2,
          batchNumber: "B-OLD",
          expiryDate: daysAgo(5),
        },
      ],
    });
    // No expiry date at all, which must not appear in an expiry report.
    await makePurchase("noexpiry", {
      orgId: mine,
      supplierId: t.supplierId,
      purchaseDate: daysAgo(3),
      items: [{ productId: sprocket, quantity: 9, unitCost: 2 }],
    });

    // The other tenant gets a full parallel set, so every scoping assertion has
    // something of its own to be wrong about.
    const theirs = t.otherOrganizationId;

    const theirMoving = await makeProduct("their-moving", {
      orgId: theirs,
      unitCost: 5,
      onHand: 7,
      reorderLevel: 10,
    });

    const theirRow = await prisma.inventory.findFirstOrThrow({
      where: { productId: theirMoving },
      select: { id: true },
    });

    await log("their-in", {
      productId: theirMoving,
      inventoryId: theirRow.id,
      movementType: "IN",
      quantity: 500,
      previousQty: 0,
      newQty: 500,
      createdAt: daysAgo(1),
      userId: t.otherUserId,
    });
    const theirCog = await makeProduct("their-cog", { orgId: theirs, unitCost: 99, onHand: 3 });
    await makePurchase("their-cog", {
      orgId: theirs,
      supplierId: t.otherSupplierId,
      purchaseDate: daysAgo(2),
      items: [{ productId: theirCog, quantity: 3, unitCost: 99, expiryDate: daysAhead(3) }],
    });
    await makePurchase("their-sprocket", {
      orgId: theirs,
      supplierId: t.otherSupplierId,
      purchaseDate: daysAgo(2),
      items: [{ productId: theirMoving, quantity: 1, unitCost: 5, expiryDate: daysAhead(4) }],
    });
  });

  const rowFor = (body: { id: string }[], productId: string) =>
    body.find((row) => row.id === productId);

  it("reports the quantity on hand, not a sum of movement magnitudes", async () => {
    const res = await basic(t.organizationId);

    expect(res.status).toBe(200);
    const row = rowFor(res.body, products.moving);
    // The stock is 60. Adding the log up gives 100 + 40 + 2 = 142 ignoring the
    // sign on the adjustment, or 140 for the two movements the legacy grouped.
    expect(row.quantityOnHand).toBe(60);
    expect(row.quantityReserved).toBe(0);
    expect(row).toMatchObject({
      name: "moving",
      unit: "pcs",
      reorderLevel: 10,
      maxStockLevel: 100,
    });
  });

  it("signs net movement: increases minus decreases plus signed adjustments", async () => {
    const window = `?startDate=${daysAgo(60).toISOString()}&endDate=${daysAgo(1).toISOString()}`;

    const res = await basic(t.organizationId, window);

    const row = rowFor(res.body, products.moving);
    // IN 100 − (OUT 40 + DAMAGED 2) + ADJUSTMENT −3 = 55.
    expect(row.netMovementInPeriod).toBe(55);
  });

  it("counts only the movements inside the window", async () => {
    // A window around the shipment alone: the receipt and the later damage are
    // outside it, so the net is the shipment on its own.
    const start = daysAgo(31);
    const end = daysAgo(29);
    const window = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;

    const res = await basic(t.organizationId, window);

    expect(rowFor(res.body, products.moving).netMovementInPeriod).toBe(-40);
  });

  it("reports netMovementInPeriod as null when no window was asked about", async () => {
    // Null rather than zero, so a caller can tell "nothing moved in this period"
    // from "no period was asked about". The distinction is the whole reason the
    // column is nullable.
    const res = await basic(t.organizationId);

    expect(rowFor(res.body, products.moving).netMovementInPeriod).toBeNull();
  });

  it("marks a product at its reorder level as below it", async () => {
    const res = await basic(t.organizationId);

    const atLevel = rowFor(res.body, products["atlevel"]);
    expect(atLevel.quantityOnHand).toBe(5);
    expect(atLevel.reorderLevel).toBe(5);
    expect(atLevel.isBelowReorderLevel).toBe(true);

    expect(rowFor(res.body, products["above-3"]).isBelowReorderLevel).toBe(false);
  });

  it("scopes every row to the caller's tenant", async () => {
    const mine = await basic(t.organizationId);
    const theirs = await basic(t.otherOrganizationId);

    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);

    const mineIds = mine.body.map((r: { id: string }) => r.id);
    const theirIds = theirs.body.map((r: { id: string }) => r.id);

    expect(mineIds).toContain(products.moving);
    expect(mineIds).not.toContain(otherProducts["their-moving"]);
    expect(theirIds).toContain(otherProducts["their-moving"]);
    expect(theirIds).not.toContain(products.moving);
  });

  it("needs a tenant, and says so", async () => {
    // The legacy report functions took no organization at all. Without the header
    // there is no tenant to scope to, so the request is refused rather than
    // answered with the whole installation.
    const res = await request(app).get("/api/reports/inventory/basic");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });

  it("returns the movement log with its audit columns, newest first", async () => {
    const res = await movements(t.organizationId);

    expect(res.status).toBe(200);

    const mine = res.body.filter(
      (row: { product: { id: string } }) => row.product.id === products.moving
    );

    expect(mine).toHaveLength(4);

    // Newest first, and the audit trail is intact: `quantity` alone would say four
    // units moved without saying whether that was four out of a hundred.
    expect(mine[0].movementType).toBe("DAMAGED");
    expect(mine[0]).toMatchObject({
      quantity: 2,
      previousQty: 57,
      newQty: 55,
    });
    expect(mine[0].inventory.quantityOnHand).toBe(60);
    expect(mine[0].user.id).toBe(t.userId);
    expect(mine[0].product.name).toBe("moving");

    for (let i = 1; i < mine.length; i += 1) {
      expect(new Date(mine[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(mine[i].createdAt).getTime()
      );
    }
  });

  it("scopes movements to the tenant through the inventory relation", async () => {
    // `InventoryLog` has no `organizationId` of its own — the columns are
    // `inventoryId`, `productId` and `userId` — so the tenant filter has to travel
    // through the relation. A log written by the *other* tenant's user, about the
    // *other* tenant's stock, is the case a missing filter shows up in.
    const mine = await movements(t.organizationId);
    const theirs = await movements(t.otherOrganizationId);

    const mineIds = mine.body.map((r: { product: { id: string } }) => r.product.id);
    const theirIds = theirs.body.map((r: { product: { id: string } }) => r.product.id);

    expect(mineIds).toContain(products.moving);
    expect(mineIds).not.toContain(otherProducts["their-moving"]);
    expect(theirIds).toEqual([otherProducts["their-moving"]]);
    expect(
      theirs.body.every((r: { user: { id: string } }) => r.user.id === t.otherUserId)
    ).toBe(true);
  });

  it("honours both window bounds inclusively", async () => {
    // A log written at exactly `startDate` and one at exactly `endDate` are both
    // inside the window, and one a millisecond outside is not.
    const productId = products.cog;
    const start = new Date("2026-03-01T00:00:00.000Z");
    const end = new Date("2026-03-31T00:00:00.000Z");

    const row = await prisma.inventory.findFirstOrThrow({
      where: { productId },
      select: { id: true },
    });

    await log("edge-start", {
      productId,
      inventoryId: row.id,
      movementType: "IN",
      quantity: 1,
      previousQty: 0,
      newQty: 1,
      createdAt: start,
      userId: t.userId,
    });
    await log("edge-end", {
      productId,
      inventoryId: row.id,
      movementType: "OUT",
      quantity: 1,
      previousQty: 1,
      newQty: 0,
      createdAt: end,
      userId: t.userId,
    });
    await log("just-after", {
      productId,
      inventoryId: row.id,
      movementType: "OUT",
      quantity: 1,
      previousQty: 0,
      newQty: 0,
      createdAt: new Date(end.getTime() + 1),
      userId: t.userId,
    });

    const res = await movements(
      t.organizationId,
      `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
    );

    const mine = res.body.filter(
      (r: { product: { id: string } }) => r.product.id === productId
    );

    expect(mine.map((r: { movementType: string }) => r.movementType).sort()).toEqual([
      "IN",
      "OUT",
    ]);
  });

  it("rejects a window that ends before it starts", async () => {
    const res = await basic(
      t.organizationId,
      `?startDate=${daysAgo(1).toISOString()}&endDate=${daysAgo(30).toISOString()}`
    );

    expect(res.status).toBe(400);
  });

  it("leaves a product with a reorder level of zero out of the low-stock report", async () => {
    const res = await lowStock(t.organizationId);

    expect(res.status).toBe(200);
    const ids = res.body.map((r: { id: string }) => r.id);

    // Zero on hand against a reorder level of zero satisfies `onHand <= reorder`.
    // `Inventory.reorderLevel` defaults to 0, so without the `gt: 0` guard every
    // product ever created with no explicit level sits in this report forever.
    expect(ids).not.toContain(products.nolevel);
  });

  it("includes a product sitting exactly at its reorder level, with a zero shortfall", async () => {
    const res = await lowStock(t.organizationId);

    const row = rowFor(res.body, products["atlevel"]);
    expect(row).toBeDefined();
    expect(row.quantityOnHand).toBe(5);
    expect(row.reorderLevel).toBe(5);
    // At the level is not below it, so there is nothing to reorder.
    expect(row.shortfall).toBe(0);
    expect(row.estimatedRestockCost).toBe(0);
  });

  it("compares each row against its own reorder level", async () => {
    // Both products hold exactly 4. A threshold written as a literal — 10, say,
    // or 5 — gets at least one of these two wrong; only a comparison between the
    // row's own columns gets both right.
    const res = await lowStock(t.organizationId);

    const ids = res.body.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(products["above-3"]);
    expect(ids).toContain(products["below-9"]);

    const row = rowFor(res.body, products["below-9"]);
    expect(row.shortfall).toBe(5);
    expect(row.estimatedRestockCost).toBe(5 * 50);
  });

  it("orders low stock by how little is left", async () => {
    const res = await lowStock(t.organizationId);

    const quantities = res.body.map((r: { quantityOnHand: number }) => r.quantityOnHand);
    const sorted = [...quantities].sort((a, b) => a - b);
    expect(quantities).toEqual(sorted);
  });

  it("names the supplier and date of the most recent purchase", async () => {
    // A supplier last bought from eight months ago is the one to reorder from,
    // and a window that excluded them is not a reason to answer "no supplier".
    const res = await lowStock(t.organizationId);

    const row = rowFor(res.body, products.cog);
    expect(row).toBeDefined();
    // The cheap purchase is 45 days old and the dear one 35, so the dear one —
    // the more recent — is the one to reorder from.
    expect(row.supplier).toMatchObject({ id: t.supplierId });
    expect(new Date(row.lastPurchaseDate).getTime()).toBe(cogDearDate.getTime());
  });

  it("scopes low stock to the tenant", async () => {
    const mine = await lowStock(t.organizationId);
    const theirs = await lowStock(t.otherOrganizationId);

    const mineIds = mine.body.map((r: { id: string }) => r.id);
    const theirIds = theirs.body.map((r: { id: string }) => r.id);

    expect(mineIds).not.toContain(otherProducts["their-moving"]);
    expect(theirIds).toEqual([otherProducts["their-moving"]]);
  });

  it("values what is on hand at the average cost the tenant paid", async () => {
    const res = await valuation(t.organizationId);

    expect(res.status).toBe(200);
    const row = rowFor(res.body.items, products.cog);
    // Bought at 4 and at 10, so 7 blended. Ten on hand is 70 — and the sum of the
    // movement magnitudes is 100, which the legacy would have valued at 700.
    expect(row.averageUnitCost).toBe(7);
    expect(row.quantityOnHand).toBe(10);
    expect(row.totalValue).toBe(70);
    expect(res.body.totalValue).toBe(
      res.body.items.reduce((sum: number, r: { totalValue: number }) => sum + r.totalValue, 0)
    );
    expect(res.body.generatedAt).toBeDefined();
  });

  it("does not mix another tenant's purchases into the average cost", async () => {
    // The other tenant bought the same shape of thing at 99. A missing tenant
    // filter on the cost side blends that into this tenant's average.
    const res = await valuation(t.organizationId);

    for (const item of res.body.items) {
      expect(item.averageUnitCost).toBeLessThan(99);
    }

    expect(rowFor(res.body.items, otherProducts["their-cog"])).toBeUndefined();
  });

  it("lists only lines that carry an expiry date, soonest first", async () => {
    const res = await expiry(t.organizationId, "?daysUntilExpiry=3650");

    expect(res.status).toBe(200);

    const mine = res.body.filter(
      (row: { productId: string }) => row.productId === products.sprocket
    );

    // The line with no expiry date is not in an expiry report.
    expect(mine).toHaveLength(3);
    expect(mine.map((r: { batchNumber: string }) => r.batchNumber)).toEqual([
      "B-OLD",
      "B-SOON",
      "B-LATER",
    ]);

    for (let i = 1; i < mine.length; i += 1) {
      expect(new Date(mine[i - 1].expiryDate).getTime()).toBeLessThanOrEqual(
        new Date(mine[i].expiryDate).getTime()
      );
    }
  });

  it("counts days until expiry and flags what has already expired", async () => {
    const res = await expiry(t.organizationId, "?daysUntilExpiry=3650");

    const soon = res.body.find((r: { batchNumber: string }) => r.batchNumber === "B-SOON");
    const old = res.body.find((r: { batchNumber: string }) => r.batchNumber === "B-OLD");

    expect(soon.daysUntilExpiry).toBe(10);
    expect(soon.isExpired).toBe(false);

    expect(old.isExpired).toBe(true);
    expect(old.daysUntilExpiry).toBeLessThan(0);
  });

  it("measures the expiry threshold from now, not from the end of the window", async () => {
    // The legacy computed the limit as `windowEnd + days`, so "expires within 30
    // days" meant 30 days after the *end of the reporting period*. With a window
    // that ended a month ago that is a different question, and it is the wrong one.
    const start = daysAgo(90);
    const end = daysAgo(60);
    const query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}&daysUntilExpiry=30`;

    const res = await expiry(t.organizationId, query);

    const batches = res.body
      .filter((r: { productId: string }) => r.productId === products.sprocket)
      .map((r: { batchNumber: string }) => r.batchNumber);

    // Ten days out is inside thirty days from now. Ninety days out is not, even
    // though the window ended two months ago and ninety days from then is also not
    // "within thirty days" — the point is that the two readings disagree and this
    // one is the first.
    expect(batches).toContain("B-SOON");
    expect(batches).not.toContain("B-LATER");
  });

  it("narrows the expiry report from below by the start date", async () => {
    // `startDate` is a bound on the *expiry* date, not on when the line was
    // bought: this report is a range of expiry dates. The legacy used
    // `new Date(0)` when the start date was missing, so the bound existed whether
    // or not one was asked for — and asking for a start date three days ago
    // should now drop the line that expired five days ago.
    const query = `?startDate=${daysAgo(3).toISOString()}&daysUntilExpiry=3650`;

    const res = await expiry(t.organizationId, query);

    const batches = res.body
      .filter((r: { productId: string }) => r.productId === products.sprocket)
      .map((r: { batchNumber: string }) => r.batchNumber);

    expect(batches).not.toContain("B-OLD");
    expect(batches).toContain("B-SOON");
    expect(batches).toContain("B-LATER");
  });

  it("reports what was bought beside what is still on hand", async () => {
    // `quantity` on a purchase line is what was bought. There is no batch or
    // stock-by-expiry table, so a batch that sold in full still appears here — the
    // honest reading is "purchased", and the row carries the product's current
    // stock so a reader can judge.
    const res = await expiry(t.organizationId, "?daysUntilExpiry=3650");

    const soon = res.body.find((r: { batchNumber: string }) => r.batchNumber === "B-SOON");
    expect(soon.purchasedQuantity).toBe(40);
    expect(soon.quantityOnHand).toBe(12);
    expect(soon.purchase.supplier).toMatchObject({ id: t.supplierId });
  });

  it("scopes the expiry report to the tenant", async () => {
    // Both other-tenant lines expire sooner than anything in this tenant, so a
    // missing filter would show up as the two earliest rows in the report.
    const res = await expiry(t.organizationId, "?daysUntilExpiry=3650");

    const productIds = new Set(
      res.body.map((r: { productId: string }) => r.productId)
    );

    expect(productIds.has(otherProducts["their-moving"])).toBe(false);
    expect(productIds.has(otherProducts["their-cog"])).toBe(false);

    const theirs = await expiry(t.otherOrganizationId, "?daysUntilExpiry=3650");
    const theirIds = theirs.body.map((r: { productId: string }) => r.productId);
    expect(theirIds.sort()).toEqual(
      [otherProducts["their-moving"], otherProducts["their-cog"]].sort()
    );
  });

  it("returns all five reports together, each matching its own endpoint", async () => {
    const res = await full(t.organizationId);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "basic",
      "expiry",
      "generatedAt",
      "lowStock",
      "movements",
      "stockValuation",
    ]);

    const [basicRes, movementsRes, lowStockRes, valuationRes, expiryRes] =
      await Promise.all([
        basic(t.organizationId),
        movements(t.organizationId),
        lowStock(t.organizationId),
        valuation(t.organizationId),
        expiry(t.organizationId, "?daysUntilExpiry=3650"),
      ]);

    expect(res.body.basic).toEqual(basicRes.body);
    expect(res.body.movements).toEqual(movementsRes.body);
    expect(res.body.lowStock).toEqual(lowStockRes.body);
    expect(res.body.stockValuation.items).toEqual(valuationRes.body.items);
    expect(res.body.stockValuation.totalValue).toBe(valuationRes.body.totalValue);
    expect(res.body.expiry).toEqual(expiryRes.body);
  });

  it("scopes the combined report to the tenant as well", async () => {
    const res = await full(t.otherOrganizationId, "?daysUntilExpiry=3650");

    const basicIds = res.body.basic.map((r: { id: string }) => r.id);
    expect(basicIds).toContain(otherProducts["their-moving"]);
    expect(basicIds).not.toContain(products.moving);
    expect(res.body.lowStock.map((r: { id: string }) => r.id)).toEqual([
      otherProducts["their-moving"],
    ]);
  });

  it("needs a tenant for the combined report too", async () => {
    const res = await request(app).get("/api/reports/inventory/full");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });
});
