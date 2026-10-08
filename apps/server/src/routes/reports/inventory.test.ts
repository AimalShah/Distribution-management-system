import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { ORGANIZATION_HEADER } from "../../middleware/auth-context";

const { inventoryModel, inventoryLogModel, purchaseItemModel, dbStub } =
  vi.hoisted(() => {
    const inventory = {
      findMany: vi.fn(),
      fields: { reorderLevel: "reorderLevel" },
    };

    const inventoryLog = {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    };

    const purchaseItem = {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    };

    const stockBatch = {
      findMany: vi.fn(),
    };

    return {
      inventoryModel: inventory,
      inventoryLogModel: inventoryLog,
      purchaseItemModel: purchaseItem,
      dbStub: {
        member: { findFirst: async () => ({ role: "owner" }) },
        $transaction: vi.fn(),
        inventory,
        inventoryLog,
        purchaseItem,
        stockBatch,
      },
    };
  });

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

const ORG = "org_1";

const OTHER_ORG = "org_other";

const asTenant = (req: request.Test, organizationId = ORG) =>
  req.set(ORGANIZATION_HEADER, organizationId);

const inventoryFixture = (overrides: Record<string, unknown> = {}) => ({
  productId: "prod_1",
  quantityOnHand: 7,
  quantityReserved: 1,
  reorderLevel: 10,
  maxStockLevel: 50,
  product: {
    id: "prod_1",
    name: "Widget",
    productCode: "W-001",
    unit: "pcs",
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  inventoryModel.fields.reorderLevel = "reorderLevel";
  inventoryModel.findMany.mockResolvedValue([inventoryFixture()]);
  inventoryLogModel.findMany.mockResolvedValue([]);
  // Three grouped sums: increases, decreases, adjustments.
  inventoryLogModel.groupBy.mockResolvedValue([]);
  purchaseItemModel.findMany.mockResolvedValue([]);
  purchaseItemModel.groupBy.mockResolvedValue([]);
  dbStub.stockBatch.findMany.mockResolvedValue([]);
});

describe("org scoping", () => {
  it.each([
    ["basic"],
    ["movements"],
    ["low-stock"],
    ["stock-valuation"],
    ["expiry"],
    ["full"],
  ])("scopes GET /api/reports/inventory/%s to the tenant", async (report) => {
    // The legacy report functions took no organization at all, so every
    // tenant saw every other tenant's stock.
    await asTenant(request(app).get(`/api/reports/inventory/${report}`));

    // `Inventory` carries the tenant; `PurchaseItem` and `InventoryLog` do not
    // and reach it through a relation, which is what the two tests below pin.
    for (const call of inventoryModel.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({ organizationId: ORG });
    }
  });

  it("scopes the movement log through the inventory relation", async () => {
    // InventoryLog has no organizationId column, so the filter has to go
    // through the relation or it scopes to nothing.
    await asTenant(request(app).get("/api/reports/inventory/movements"));

    expect(inventoryLogModel.findMany.mock.calls[0][0].where).toMatchObject({
      inventory: { organizationId: ORG },
    });
  });

  it("scopes purchase lines through the purchase relation", async () => {
    await asTenant(request(app).get("/api/reports/inventory/low-stock"));

    expect(purchaseItemModel.findMany.mock.calls[0][0].where).toMatchObject({
      purchase: { organizationId: ORG },
    });
  });

  it("does not read another tenant's data when the header names one", async () => {
    await asTenant(request(app).get("/api/reports/inventory/basic"), OTHER_ORG);

    expect(inventoryModel.findMany.mock.calls[0][0].where.organizationId).toBe(
      OTHER_ORG
    );
  });

  it("400s without a tenant header", async () => {
    const res = await request(app).get("/api/reports/inventory/basic");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(inventoryModel.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/inventory/basic", () => {
  it("reports the quantity actually on hand", async () => {
    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    expect(res.status).toBe(200);
    expect(res.body[0].quantityOnHand).toBe(7);
  });

  it("does not report a sum of movement magnitudes as a quantity", async () => {
    // The legacy groupBy'd `quantity` and called the result totalQuantity. That
    // column is a magnitude: an OUT of 4 logs quantity 4, so receiving 100 and
    // shipping 100 scored 200.
    inventoryLogModel.groupBy
      .mockResolvedValueOnce([{ productId: "prod_1", _sum: { quantity: 100 } }])
      .mockResolvedValueOnce([{ productId: "prod_1", _sum: { quantity: 100 } }])
      .mockResolvedValueOnce([]);

    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    expect(res.body[0]).not.toHaveProperty("totalQuantity");
    expect(res.body[0].quantityOnHand).toBe(7);
  });

  it("nets an increase against a decrease in the window", async () => {
    inventoryLogModel.groupBy
      .mockResolvedValueOnce([{ productId: "prod_1", _sum: { quantity: 100 } }])
      .mockResolvedValueOnce([{ productId: "prod_1", _sum: { quantity: 40 } }])
      .mockResolvedValueOnce([]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/basic?startDate=2026-01-01")
    );

    expect(res.body[0].netMovementInPeriod).toBe(60);
  });

  it("adds a signed adjustment to the net", async () => {
    // ADJUSTMENT is the one type whose logged quantity is signed: it is the
    // difference a physical count found.
    inventoryLogModel.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ productId: "prod_1", _sum: { quantity: -3 } }]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/basic?startDate=2026-01-01")
    );

    expect(res.body[0].netMovementInPeriod).toBe(-3);
  });

  it("reports no net movement at all when no window was asked for", async () => {
    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    // Null rather than 0, so "nothing moved in this period" is distinguishable
    // from "no period was asked about".
    expect(res.body[0].netMovementInPeriod).toBeNull();
  });

  it("flags a product below its reorder level", async () => {
    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    expect(res.body[0].isBelowReorderLevel).toBe(true);
  });

  it("lists products that never moved in the window", async () => {
    // The legacy built the report from the movements and read inventory for the
    // products those movements named, so anything sitting still was absent.
    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    expect(inventoryModel.findMany).toHaveBeenCalled();
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/reports/inventory/movements", () => {
  const logFixture = (overrides: Record<string, unknown> = {}) => ({
    id: "log_1",
    movementType: "OUT",
    quantity: 4,
    previousQty: 10,
    newQty: 6,
    reason: "sale",
    reference: "sale_1",
    createdAt: new Date("2026-01-05T00:00:00.000Z"),
    product: { id: "prod_1", name: "Widget", productCode: "W-001" },
    inventory: { quantityOnHand: 6 },
    user: { id: "user_1", name: "Ana", email: "ana@example.com" },
    ...overrides,
  });

  it("returns the log rows", async () => {
    inventoryLogModel.findMany.mockResolvedValue([logFixture()]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/movements")
    );

    expect(res.status).toBe(200);
    expect(res.body[0].movementType).toBe("OUT");
  });

  it("includes the opening and closing figures", async () => {
    // `quantity` alone says 4 units moved and not whether that was out of 100
    // or out of 5.
    const res = await asTenant(
      request(app).get("/api/reports/inventory/movements")
    );

    const select = inventoryLogModel.findMany.mock.calls[0][0].select;
    expect(select.previousQty).toBe(true);
    expect(select.newQty).toBe(true);
    expect(select.user.select.email).toBe(true);
  });

  it("applies a date window when one is given", async () => {
    await asTenant(
      request(app).get(
        "/api/reports/inventory/movements?startDate=2026-01-01&endDate=2026-01-31"
      )
    );

    expect(
      inventoryLogModel.findMany.mock.calls[0][0].where.createdAt
    ).toEqual({
      gte: new Date("2026-01-01"),
      lte: new Date("2026-01-31"),
    });
  });

  it("applies no date filter when no window is given", async () => {
    await asTenant(request(app).get("/api/reports/inventory/movements"));

    expect(
      inventoryLogModel.findMany.mock.calls[0][0].where.createdAt
    ).toBeUndefined();
  });

  it("orders newest first", async () => {
    await asTenant(request(app).get("/api/reports/inventory/movements"));

    expect(inventoryLogModel.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: "desc",
    });
  });
});

describe("GET /api/reports/inventory/low-stock", () => {
  it("compares quantity on hand against the reorder level field", async () => {
    await asTenant(request(app).get("/api/reports/inventory/low-stock"));

    expect(inventoryModel.findMany.mock.calls[0][0].where.quantityOnHand).toEqual({
      lte: "reorderLevel",
    });
  });

  it("excludes products that have no reorder level", async () => {
    // reorderLevel is @default(0), so with a plain `lte` every product created
    // without an explicit level appears forever at zero on hand, having never
    // been below anything.
    await asTenant(request(app).get("/api/reports/inventory/low-stock"));

    expect(inventoryModel.findMany.mock.calls[0][0].where.reorderLevel).toEqual({
      gt: 0,
    });
  });

  it("computes the shortfall against the reorder level", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/low-stock")
    );

    expect(res.body[0].shortfall).toBe(3);
  });

  it("prices the restock at the product's unit cost", async () => {
    inventoryModel.findMany.mockResolvedValue([
      inventoryFixture({
        product: {
          id: "prod_1",
          name: "Widget",
          productCode: "W-001",
          unit: "pcs",
          unitCost: 5,
        },
      }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/low-stock")
    );

    expect(res.body[0].estimatedRestockCost).toBe(15);
  });

  it("falls back to the most recent purchase outside the window", async () => {
    // A supplier last bought from eight months ago is the one to reorder from.
    purchaseItemModel.findMany.mockResolvedValue([
      {
        productId: "prod_1",
        purchase: {
          purchaseDate: new Date("2025-05-01"),
          supplier: { id: "sup_1", companyName: "Acme Supplies" },
        },
      },
    ]);

    const res = await asTenant(
      request(app).get(
        "/api/reports/inventory/low-stock?startDate=2026-01-01&endDate=2026-01-31"
      )
    );

    expect(res.body[0].supplier.companyName).toBe("Acme Supplies");
  });

  it("reports a null supplier when the product was never purchased", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/low-stock")
    );

    expect(res.body[0].supplier).toBeNull();
  });
});

describe("GET /api/reports/inventory/stock-valuation", () => {
  it("values the quantity on hand, not the movement total", async () => {
    inventoryModel.findMany.mockResolvedValue([
      inventoryFixture({
        productId: "prod_1",
        quantityOnHand: 20,
        product: {
          id: "prod_1",
          name: "Widget",
          productCode: "W-001",
          unit: "pcs",
        },
      }),
    ]);
    purchaseItemModel.groupBy.mockResolvedValue([
      { productId: "prod_1", _avg: { unitCost: 2.5 } },
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/stock-valuation")
    );

    expect(res.body.items[0].totalValue).toBe(50);
    expect(res.body.totalValue).toBe(50);
  });

  it("values at the tenant's average purchase cost", async () => {
    purchaseItemModel.groupBy.mockResolvedValue([
      { productId: "prod_1", _avg: { unitCost: 2.5 } },
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/inventory/stock-valuation")
    );

    expect(res.body.items[0].averageUnitCost).toBe(2.5);
  });

  it("scopes the cost basis to the tenant's purchases", async () => {
    await asTenant(request(app).get("/api/reports/inventory/stock-valuation"));

    expect(purchaseItemModel.groupBy.mock.calls[0][0].where).toMatchObject({
      purchase: { organizationId: ORG },
    });
  });

  it("values at zero when the product was never purchased", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/stock-valuation")
    );

    expect(res.body.items[0].totalValue).toBe(0);
  });
});

describe("GET /api/reports/inventory/expiry", () => {
  const itemFixture = (overrides: Record<string, unknown> = {}) => ({
    id: "pi_1",
    productId: "prod_1",
    quantity: 40,
    unitCost: 3,
    totalCost: 120,
    batchNumber: "B-1",
    expiryDate: new Date("2026-02-01"),
    product: {
      id: "prod_1",
      name: "Widget",
      productCode: "W-001",
      unit: "pcs",
    },
    purchase: {
      id: "pur_1",
      purchaseCode: "P-001",
      purchaseDate: new Date("2025-08-01"),
      organizationId: ORG,
      supplier: { id: "sup_1", companyName: "Acme Supplies" },
    },
    ...overrides,
  });

  it("names the purchased quantity for what it is", async () => {
    // Expiry lives on the purchase line and nowhere else, so there is no way to
    // ask how much of a batch is still on hand. A batch that sold in full still
    // appears here with 40 units "about to expire".
    purchaseItemModel.findMany.mockResolvedValue([itemFixture()]);

    const res = await asTenant(request(app).get("/api/reports/inventory/expiry"));

    expect(res.body[0].purchasedQuantity).toBe(40);
    expect(res.body[0]).not.toHaveProperty("quantity");
  });

  it("carries the product's current stock beside it for context", async () => {
    purchaseItemModel.findMany.mockResolvedValue([itemFixture()]);
    inventoryModel.findMany.mockResolvedValue([
      { productId: "prod_1", quantityOnHand: 0 },
    ]);

    const res = await asTenant(request(app).get("/api/reports/inventory/expiry"));

    expect(res.body[0].quantityOnHand).toBe(0);
  });

  it("honours daysUntilExpiry, which the legacy silently ignored", async () => {
    // Number.isFinite("30") is false for the string a query param always is, so
    // the threshold never applied to any caller reaching it over HTTP.
    purchaseItemModel.findMany.mockResolvedValue([itemFixture()]);

    await asTenant(
      request(app).get("/api/reports/inventory/expiry?daysUntilExpiry=30")
    );

    const where = purchaseItemModel.findMany.mock.calls[0][0].where;
    expect(where.expiryDate.lte).toBeInstanceOf(Date);
    expect(where.expiryDate.lte.getTime()).toBeGreaterThan(Date.now());
  });

  it("measures the expiry threshold from now, not from the end of the window", async () => {
    // The legacy added the days to windowEnd, so "within 30 days" meant 30 days
    // after the reporting period ended.
    purchaseItemModel.findMany.mockResolvedValue([itemFixture()]);

    await asTenant(
      request(app).get(
        "/api/reports/inventory/expiry?startDate=2026-06-01&endDate=2026-06-30&daysUntilExpiry=30"
      )
    );

    const where = purchaseItemModel.findMany.mock.calls[0][0].where;
    const limit = where.expiryDate.lte.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(limit).toBeLessThanOrEqual(Date.now() + thirtyDays + 1000);
    expect(limit).toBeGreaterThan(Date.now() + thirtyDays - 1000);
  });

  it("asks for no lower bound when no start date is given", async () => {
    // The legacy used new Date(0), which requests every purchase line ever
    // written.
    await asTenant(request(app).get("/api/reports/inventory/expiry"));

    const where = purchaseItemModel.findMany.mock.calls[0][0].where;
    expect(where.expiryDate.gte).toBeUndefined();
  });

  it("excludes purchase lines with no expiry date", async () => {
    await asTenant(request(app).get("/api/reports/inventory/expiry"));

    expect(
      purchaseItemModel.findMany.mock.calls[0][0].where.expiryDate.not
    ).toBeNull();
  });

  it("computes days until expiry and whether it has passed", async () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    purchaseItemModel.findMany.mockResolvedValue([
      itemFixture({ expiryDate: soon }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/inventory/expiry"));

    expect(res.body[0].daysUntilExpiry).toBe(5);
    expect(res.body[0].isExpired).toBe(false);
  });

  it("marks a past expiry as expired", async () => {
    purchaseItemModel.findMany.mockResolvedValue([
      itemFixture({ expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/inventory/expiry"));

    expect(res.body[0].isExpired).toBe(true);
    expect(res.body[0].daysUntilExpiry).toBe(-5);
  });
});

describe("date validation", () => {
  it.each([
    "startDate=last-tuesday",
    "endDate=not-a-date",
    "startDate=2026-13-45",
  ])("400s an unparseable date (%s)", async (query) => {
    // The legacy did new Date(undefined) and compared it: every
    // `createdAt >= Invalid Date` is false, so the report came back empty and
    // looked like a tenant with no stock.
    const res = await asTenant(
      request(app).get(`/api/reports/inventory/basic?${query}`)
    );

    expect(res.status).toBe(400);
    expect(inventoryModel.findMany).not.toHaveBeenCalled();
  });

  it("400s a reversed range", async () => {
    const res = await asTenant(
      request(app).get(
        "/api/reports/inventory/basic?startDate=2026-02-01&endDate=2026-01-01"
      )
    );

    expect(res.status).toBe(400);
  });

  it("400s a negative daysUntilExpiry", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/expiry?daysUntilExpiry=-5")
    );

    expect(res.status).toBe(400);
  });

  it("400s a fractional daysUntilExpiry", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/expiry?daysUntilExpiry=2.5")
    );

    expect(res.status).toBe(400);
  });

  it("accepts a window with only one end", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/inventory/basic?startDate=2026-01-01")
    );

    expect(res.status).toBe(200);
  });

  it("works with no window at all", async () => {
    const res = await asTenant(request(app).get("/api/reports/inventory/basic"));

    expect(res.status).toBe(200);
  });
});

describe("GET /api/reports/inventory/full", () => {
  it("returns every report together", async () => {
    const res = await asTenant(request(app).get("/api/reports/inventory/full"));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "basic",
      "expiry",
      "generatedAt",
      "lowStock",
      "movements",
      "stockValuation",
    ]);
  });

  it("scopes every report it combines", async () => {
    await asTenant(request(app).get("/api/reports/inventory/full"));

    for (const call of inventoryModel.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({ organizationId: ORG });
    }

    for (const call of purchaseItemModel.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({ purchase: { organizationId: ORG } });
    }
  });
});
