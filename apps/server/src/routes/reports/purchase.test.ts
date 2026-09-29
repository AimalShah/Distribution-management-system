import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { ORGANIZATION_HEADER } from "../../middleware/auth-context";

const { purchaseModel, purchaseItemModel, dbStub } = vi.hoisted(() => {
  const purchase = {
    findMany: vi.fn(),
  };
  const purchaseItem = {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  };

  return {
    purchaseModel: purchase,
    purchaseItemModel: purchaseItem,
    dbStub: {
      $transaction: vi.fn(),
      purchase,
      purchaseItem,
    },
  };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_other";

const asTenant = (req: request.Test, organizationId = ORG) =>
  req.set(ORGANIZATION_HEADER, organizationId);

const purchaseFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "pur_1",
  purchaseCode: "PO-001",
  purchaseDate: new Date("2026-03-10T00:00:00.000Z"),
  totalAmount: 250,
  status: "Completed",
  supplierId: "sup_1",
  supplier: { companyName: "Acme Supply" },
  ...overrides,
});

const lineFixture = (overrides: Record<string, unknown> = {}) => ({
  productId: "prod_1",
  quantity: 10,
  unitCost: 5,
  totalCost: 50,
  product: { name: "Widget", productCode: "W-001", unit: "pcs" },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  purchaseModel.findMany.mockResolvedValue([purchaseFixture()]);
  purchaseItemModel.findMany.mockResolvedValue([lineFixture()]);
  purchaseItemModel.groupBy.mockResolvedValue([
    { purchaseId: "pur_1", _sum: { quantity: 10 } },
  ]);
});

describe("org scoping", () => {
  it.each([["basic"], ["by-supplier"], ["by-product"], ["full"]])(
    "scopes GET /api/reports/purchase/%s to the tenant",
    async (report) => {
      // None of the three legacy functions took an organization, so every
      // tenant saw every other tenant's spend, suppliers and products.
      await asTenant(request(app).get(`/api/reports/purchase/${report}`));

      for (const call of purchaseModel.findMany.mock.calls) {
        expect(call[0].where).toMatchObject({ organizationId: ORG });
      }
    }
  );

  it("scopes purchase lines through the purchase relation", async () => {
    // PurchaseItem has no organizationId column, so the tenant has to be
    // reached through `purchase` or the filter scopes to nothing.
    await asTenant(request(app).get("/api/reports/purchase/by-product"));

    expect(purchaseItemModel.findMany.mock.calls[0][0].where).toMatchObject({
      purchase: { organizationId: ORG },
    });
  });

  it("scopes the line-quantity sum through the purchase relation", async () => {
    await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(purchaseItemModel.groupBy.mock.calls[0][0].where).toMatchObject({
      purchase: { organizationId: ORG },
    });
  });

  it("reads the tenant the header names", async () => {
    await asTenant(request(app).get("/api/reports/purchase/basic"), OTHER_ORG);

    expect(purchaseModel.findMany.mock.calls[0][0].where.organizationId).toBe(
      OTHER_ORG
    );
  });

  it("400s without a tenant header", async () => {
    const res = await request(app).get("/api/reports/purchase/basic");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });
});

describe("GET /api/reports/purchase/basic", () => {
  it("totals the window", async () => {
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({
        id: "pur_2",
        purchaseCode: "PO-002",
        purchaseDate: new Date("2026-03-11T00:00:00.000Z"),
        totalAmount: 100,
        supplierId: "sup_2",
      }),
    ]);
    purchaseItemModel.groupBy.mockResolvedValue([
      { purchaseId: "pur_1", _sum: { quantity: 10 } },
      { purchaseId: "pur_2", _sum: { quantity: 4 } },
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalPurchaseAmount: 350,
      totalOrders: 2,
      uniqueSuppliers: 2,
      totalLineItems: 2,
      totalQuantity: 14,
    });
  });

  it("counts line items, not units, under its own name", async () => {
    // The legacy reported `purchases.reduce((s, p) => s + p.purchaseItems.length,
    // 0)` as "totalItems" beside a quantity. A reader takes that for units
    // bought, and one line for 500 units counted as one.
    purchaseItemModel.groupBy.mockResolvedValue([
      { purchaseId: "pur_1", _sum: { quantity: 500 } },
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.totalLineItems).toBe(1);
    expect(res.body.totalQuantity).toBe(500);
    expect(res.body).not.toHaveProperty("totalItems");
  });

  it("counts a distinct supplier by id, not by name", async () => {
    // The name-keyed grouping is what by-supplier got wrong; the count was
    // already on supplierId. One supplier, two orders: one.
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({ id: "pur_2", supplierId: "sup_1" }),
      purchaseFixture({ id: "pur_3", supplierId: "sup_2" }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.uniqueSuppliers).toBe(2);
  });

  it("buckets daily totals by the stored calendar day, in order", async () => {
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture({
        id: "pur_2",
        purchaseDate: new Date("2026-03-09T00:00:00.000Z"),
        totalAmount: 75,
      }),
      purchaseFixture(),
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.dailyTotals).toEqual([
      { date: "2026-03-09", total: 75 },
      { date: "2026-03-10", total: 250 },
    ]);
  });

  it("adds same-day purchases into one daily total", async () => {
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({ id: "pur_2", totalAmount: 30 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.dailyTotals).toEqual([{ date: "2026-03-10", total: 280 }]);
  });

  it("reports the status split rather than adding pending into completed", async () => {
    // `status` is free text and nothing filtered on it, so a pending order was
    // added into the same "total purchase amount" as a completed one.
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({ id: "pur_2", totalAmount: 40, status: "Pending" }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.totalPurchaseAmount).toBe(290);
    expect(res.body.byStatus).toEqual([
      { status: "Completed", orders: 1, totalAmount: 250 },
      { status: "Pending", orders: 1, totalAmount: 40 },
    ]);
  });

  it("reads a purchase with no status as Unspecified", async () => {
    // The column is `String` with a comment, not an enum, and nothing defaults
    // it, so an empty status is reachable and must not become an empty-string
    // row.
    purchaseModel.findMany.mockResolvedValue([purchaseFixture({ status: "" })]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.byStatus).toEqual([
      { status: "Unspecified", orders: 1, totalAmount: 250 },
    ]);
  });

  it("returns zeros for a window with no purchases", async () => {
    purchaseModel.findMany.mockResolvedValue([]);
    purchaseItemModel.groupBy.mockResolvedValue([]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body).toMatchObject({
      totalPurchaseAmount: 0,
      totalOrders: 0,
      uniqueSuppliers: 0,
      totalLineItems: 0,
      totalQuantity: 0,
      dailyTotals: [],
      byStatus: [],
    });
  });
});

describe("GET /api/reports/purchase/basic date window", () => {
  it("passes a supplied window to the query", async () => {
    await asTenant(
      request(app).get(
        "/api/reports/purchase/basic?startDate=2026-03-01&endDate=2026-03-31"
      )
    );

    const where = purchaseModel.findMany.mock.calls[0][0].where;
    expect(where.purchaseDate).toMatchObject({
      gte: new Date("2026-03-01"),
      lte: new Date("2026-03-31"),
    });
  });

  it("sends no purchaseDate filter at all when no window is given", async () => {
    await asTenant(request(app).get("/api/reports/purchase/basic"));

    // The legacy built `{ gte: new Date(undefined), lte: new Date(undefined) }`
    // when the params were missing, which is an Invalid Date, and every
    // `purchaseDate >= Invalid Date` is false — so an unfiltered call silently
    // reported nothing at all.
    expect(purchaseModel.findMany.mock.calls[0][0].where).not.toHaveProperty(
      "purchaseDate"
    );
  });

  it("applies only the bound that was given", async () => {
    await asTenant(
      request(app).get("/api/reports/purchase/basic?startDate=2026-03-01")
    );

    expect(purchaseModel.findMany.mock.calls[0][0].where.purchaseDate).toEqual({
      gte: new Date("2026-03-01"),
    });
  });

  it("400s an unparseable date instead of returning nothing", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/purchase/basic?startDate=last-tuesday")
    );

    expect(res.status).toBe(400);
  });

  it("400s a reversed window", async () => {
    const res = await asTenant(
      request(app).get(
        "/api/reports/purchase/basic?startDate=2026-03-31&endDate=2026-03-01"
      )
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /api/reports/purchase/by-supplier", () => {
  it("keeps two suppliers that share a company name apart", async () => {
    // The legacy keyed the accumulator on companyName, so same-named suppliers
    // merged into one row with their spend added together.
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture({ supplierId: "sup_1" }),
      purchaseFixture({
        id: "pur_2",
        supplierId: "sup_2",
        totalAmount: 100,
      }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([
      { supplierId: "sup_1", companyName: "Acme Supply", orders: 1, totalAmount: 250 },
      { supplierId: "sup_2", companyName: "Acme Supply", orders: 1, totalAmount: 100 },
    ]);
  });

  it("adds repeat orders for one supplier", async () => {
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({ id: "pur_2", totalAmount: 100 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([
      { supplierId: "sup_1", companyName: "Acme Supply", orders: 2, totalAmount: 350 },
    ]);
  });

  it("sorts by spend, highest first", async () => {
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture({ supplierId: "sup_1", totalAmount: 10 }),
      purchaseFixture({ supplierId: "sup_2", totalAmount: 900 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body.map((r: { supplierId: string }) => r.supplierId)).toEqual([
      "sup_2",
      "sup_1",
    ]);
  });

  it("returns an empty list when nothing was purchased", async () => {
    purchaseModel.findMany.mockResolvedValue([]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([]);
  });
});

describe("GET /api/reports/purchase/by-product", () => {
  it("keeps two products that share a name apart", async () => {
    // Same name-keyed accumulator as the supplier report, same collision.
    purchaseItemModel.findMany.mockResolvedValue([
      lineFixture({ productId: "prod_1" }),
      lineFixture({ productId: "prod_2", totalCost: 30 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body.map((r: { productId: string }) => r.productId).sort()).toEqual(
      ["prod_1", "prod_2"]
    );
  });

  it("adds quantities and cost across lines", async () => {
    purchaseItemModel.findMany.mockResolvedValue([
      lineFixture({ quantity: 10, unitCost: 5, totalCost: 50 }),
      lineFixture({ quantity: 5, unitCost: 7, totalCost: 35 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body).toEqual([
      {
        productId: "prod_1",
        name: "Widget",
        productCode: "W-001",
        unit: "pcs",
        quantity: 15,
        totalCost: 85,
        averageUnitCost: 6,
      },
    ]);
  });

  it("carries quantity so 1 at 100 and 100 at 1 are distinguishable", async () => {
    // A spend figure alone cannot tell those apart, and they want opposite
    // decisions.
    purchaseItemModel.findMany.mockResolvedValue([
      lineFixture({ quantity: 1, unitCost: 100, totalCost: 100 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body[0]).toMatchObject({ quantity: 1, averageUnitCost: 100 });
  });

  it("sorts by spend, highest first", async () => {
    purchaseItemModel.findMany.mockResolvedValue([
      lineFixture({ productId: "prod_1", totalCost: 10 }),
      lineFixture({ productId: "prod_2", totalCost: 900 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body.map((r: { productId: string }) => r.productId)).toEqual([
      "prod_2",
      "prod_1",
    ]);
  });

  it("returns an empty list when nothing was purchased", async () => {
    purchaseItemModel.findMany.mockResolvedValue([]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body).toEqual([]);
  });
});

describe("GET /api/reports/purchase/full", () => {
  it("returns all three reports", async () => {
    const res = await asTenant(request(app).get("/api/reports/purchase/full"));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("basic");
    expect(res.body).toHaveProperty("bySupplier");
    expect(res.body).toHaveProperty("byProduct");
  });

  it("agrees with the individual reports", async () => {
    const res = await asTenant(request(app).get("/api/reports/purchase/full"));

    const basic = await asTenant(request(app).get("/api/reports/purchase/basic"));
    const bySupplier = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );
    const byProduct = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body.basic).toEqual(basic.body);
    expect(res.body.bySupplier).toEqual(bySupplier.body);
    expect(res.body.byProduct).toEqual(byProduct.body);
  });

  it("passes its window to all three", async () => {
    await asTenant(
      request(app).get(
        "/api/reports/purchase/full?startDate=2026-03-01&endDate=2026-03-31"
      )
    );

    for (const call of purchaseModel.findMany.mock.calls) {
      expect(call[0].where.purchaseDate).toMatchObject({
        gte: new Date("2026-03-01"),
        lte: new Date("2026-03-31"),
      });
    }
    expect(
      purchaseItemModel.findMany.mock.calls[0][0].where.purchase.purchaseDate
    ).toMatchObject({ gte: new Date("2026-03-01") });
  });

  it("400s a bad window like the others", async () => {
    const res = await asTenant(
      request(app).get(
        "/api/reports/purchase/full?startDate=2026-03-31&endDate=2026-03-01"
      )
    );

    expect(res.status).toBe(400);
  });
});
