import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { ORGANIZATION_HEADER } from "../../middleware/auth-context";

const { purchaseModel, purchaseItemModel, supplierModel, productModel, dbStub } =
  vi.hoisted(() => {
    const purchase = {
      findMany: vi.fn(),
      // The by-supplier report counts and sums in the database rather than
      // loading every purchase in the window and folding it in JavaScript.
      groupBy: vi.fn(),
    };

    const purchaseItem = {
      findMany: vi.fn(),
      // Two reports share this model and group by different keys: the basic
      // report by purchaseId, the by-product report by productId. The mock
      // dispatches on the key so both can be seeded independently.
      groupBy: vi.fn(),
    };

    // The grouped reports look the display fields up for the keys they grouped
    // on, in a second scoped query.
    const supplier = { findMany: vi.fn() };
    const product = { findMany: vi.fn() };

    return {
      purchaseModel: purchase,
      purchaseItemModel: purchaseItem,
      supplierModel: supplier,
      productModel: product,
      dbStub: {
        member: { findFirst: async () => ({ role: "owner" }) },
        $transaction: vi.fn(),
        purchase,
        purchaseItem,
        supplier,
        product,
      },
    };
  });

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

// Seed the grouped reports. `rows` are raw records for the reports that load
// documents; `groups` are the aggregates the database would have returned.
const seedSupplierGroups = (rows: Record<string, unknown>[]) => {
  const bySupplier = new Map<string, { orders: number; total: number }>();

  for (const row of rows) {
    const id = row.supplierId as string;
    const bucket = bySupplier.get(id) ?? { orders: 0, total: 0 };
    bucket.orders += 1;
    bucket.total += row.totalAmount as number;
    bySupplier.set(id, bucket);
  }

  // The report orders by summed total in SQL, so the mock returns them in that
  // order rather than making the service re-sort.
  return [...bySupplier.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([supplierId, bucket]) => ({
      supplierId,
      _count: { _all: bucket.orders },
      _sum: { totalAmount: bucket.total },
    }));
};

const seedProductGroups = (rows: Record<string, unknown>[]) => {
  const byProduct = new Map<
    string,
    { quantity: number; totalCost: number; costSum: number; lines: number }
  >();

  for (const row of rows) {
    const id = row.productId as string;

    const bucket = byProduct.get(id) ?? {
      quantity: 0,
      totalCost: 0,
      costSum: 0,
      lines: 0,
    };

    bucket.quantity += row.quantity as number;
    bucket.totalCost += row.totalCost as number;
    bucket.costSum += row.unitCost as number;
    bucket.lines += 1;
    byProduct.set(id, bucket);
  }

  return [...byProduct.entries()]
    .sort((a, b) => b[1].totalCost - a[1].totalCost)
    .map(([productId, bucket]) => ({
      productId,
      _count: { _all: bucket.lines },
      _sum: {
        quantity: bucket.quantity,
        totalCost: bucket.totalCost,
        unitCost: bucket.costSum,
      },
    }));
};

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
  supplierModel.findMany.mockResolvedValue([
    { id: "sup_1", companyName: "Acme Supply" },
    { id: "sup_2", companyName: "Acme Supply" },
  ]);
  productModel.findMany.mockResolvedValue([
    { id: "prod_1", name: "Widget", productCode: "W-001", unit: "pcs" },
    { id: "prod_2", name: "Widget", productCode: "W-002", unit: "pcs" },
  ]);
  purchaseModel.groupBy.mockResolvedValue([]);
  // Dispatch on the grouping key: the basic report wants per-purchase subtotals,
  // the by-product report wants per-product aggregates. Neither seeds rows unless
  // a test asks for them.
  //
  // `_count` is part of the answer the basic report reads, not decoration: it is
  // how the number of lines is counted, since the groups are keyed on purchaseId
  // and there is one group per purchase with a line rather than one per line.
  purchaseItemModel.groupBy.mockImplementation(async ({ by }) =>
    by[0] === "productId"
      ? []
      : [{ purchaseId: "pur_1", _count: { _all: 1 }, _sum: { quantity: 10 } }]
  );
  purchaseItemModel.findMany.mockResolvedValue([lineFixture()]);
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
    // reached through `purchase` or the filter scopes to nothing. The by-product
    // report groups its lines in the database, so the predicate under test is the
    // `groupBy` one rather than a `findMany`.
    await asTenant(request(app).get("/api/reports/purchase/by-product"));

    const calls = purchaseItemModel.groupBy.mock.calls.filter(
      (call) => call[0].by[0] === "productId"
    );

    expect(calls).toHaveLength(1);
    expect(calls[0][0].where).toMatchObject({ purchase: { organizationId: ORG } });
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
      { purchaseId: "pur_1", _count: { _all: 1 }, _sum: { quantity: 10 } },
      { purchaseId: "pur_2", _count: { _all: 1 }, _sum: { quantity: 4 } },
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
      { purchaseId: "pur_1", _count: { _all: 1 }, _sum: { quantity: 500 } },
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.totalLineItems).toBe(1);
    expect(res.body.totalQuantity).toBe(500);
    expect(res.body).not.toHaveProperty("totalItems");
  });

  it("counts the lines in a purchase, not the purchases that have lines", async () => {
    // The groups are keyed on `purchaseId`, so one group is one order however many
    // lines it has. Reading the group count answered `totalOrders` again under a
    // name that promises lines, which is the confusion the rename was meant to
    // end: three lines on one order is three lines.
    purchaseItemModel.groupBy.mockResolvedValue([
      { purchaseId: "pur_1", _count: { _all: 3 }, _sum: { quantity: 12 } },
      { purchaseId: "pur_2", _count: { _all: 1 }, _sum: { quantity: 1 } },
    ]);
    purchaseModel.findMany.mockResolvedValue([
      purchaseFixture(),
      purchaseFixture({ id: "pur_2", purchaseCode: "PO-002", totalAmount: 10 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/purchase/basic"));

    expect(res.body.totalLineItems).toBe(4);
    expect(res.body.totalOrders).toBe(2);
    expect(res.body.totalQuantity).toBe(13);
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
  // These seed `groupBy` rather than raw purchases: the report counts and sums in
  // the database, so what it reads is already aggregated. The assertions are
  // unchanged -- same rows, same order, same numbers as when the folding happened
  // in JavaScript.

  it("keeps two suppliers that share a company name apart", async () => {
    // The legacy keyed the accumulator on companyName, so same-named suppliers
    // merged into one row with their spend added together.
    purchaseModel.groupBy.mockResolvedValue(
      seedSupplierGroups([
        purchaseFixture({ supplierId: "sup_1" }),
        purchaseFixture({ id: "pur_2", supplierId: "sup_2", totalAmount: 100 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([
      { supplierId: "sup_1", companyName: "Acme Supply", orders: 1, totalAmount: 250 },
      { supplierId: "sup_2", companyName: "Acme Supply", orders: 1, totalAmount: 100 },
    ]);
  });

  it("adds repeat orders for one supplier", async () => {
    purchaseModel.groupBy.mockResolvedValue(
      seedSupplierGroups([
        purchaseFixture(),
        purchaseFixture({ id: "pur_2", totalAmount: 100 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([
      { supplierId: "sup_1", companyName: "Acme Supply", orders: 2, totalAmount: 350 },
    ]);
  });

  it("sorts by spend, highest first", async () => {
    // The ordering is the database's `orderBy` now, not a `.sort()` after the
    // fact, so the mock returns the groups already in that order and the response
    // has to come back that way without the service re-sorting.
    purchaseModel.groupBy.mockResolvedValue(
      seedSupplierGroups([
        purchaseFixture({ supplierId: "sup_1", totalAmount: 10 }),
        purchaseFixture({ supplierId: "sup_2", totalAmount: 900 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body.map((r: { supplierId: string }) => r.supplierId)).toEqual([
      "sup_2",
      "sup_1",
    ]);
  });

  it("returns an empty list when nothing was purchased", async () => {
    purchaseModel.groupBy.mockResolvedValue([]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-supplier")
    );

    expect(res.body).toEqual([]);
  });

  it("aggregates in the database instead of loading every purchase", async () => {
    // The response has one line per supplier. The old shape was `findMany` over
    // the whole window -- one row per purchase, joined to Supplier on each -- so
    // the memory grew with the tenant's history while the payload did not.
    purchaseModel.groupBy.mockResolvedValue(
      seedSupplierGroups([purchaseFixture(), purchaseFixture({ id: "pur_2" })])
    );

    await asTenant(request(app).get("/api/reports/purchase/by-supplier"));

    expect(purchaseModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["supplierId"],
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: "desc" } },
      })
    );
    expect(purchaseModel.findMany).not.toHaveBeenCalled();
  });

  it("scopes the group and the name lookup to the tenant", async () => {
    purchaseModel.groupBy.mockResolvedValue(
      seedSupplierGroups([purchaseFixture()])
    );

    await asTenant(request(app).get("/api/reports/purchase/by-supplier"));

    expect(purchaseModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
    // The second query must be scoped too, or a group key resolves to another
    // tenant's company name.
    expect(supplierModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
  });
});

describe("GET /api/reports/purchase/by-product", () => {
  // Seeded on `groupBy` for the same reason as the supplier report: the sums are
  // the database's now. The expected rows are unchanged.

  const seedProductLines = (rows: Record<string, unknown>[]) => {
    purchaseItemModel.groupBy.mockImplementation(async ({ by }) =>
      by[0] === "productId"
        ? seedProductGroups(rows)
        : [{ purchaseId: "pur_1", _count: { _all: 1 }, _sum: { quantity: 10 } }]
    );
  };

  it("keeps two products that share a name apart", async () => {
    // Same name-keyed accumulator as the supplier report, same collision.
    seedProductLines([
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
    seedProductLines([
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
    seedProductLines([
      lineFixture({ quantity: 1, unitCost: 100, totalCost: 100 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body[0]).toMatchObject({ quantity: 1, averageUnitCost: 100 });
  });

  it("averages the line costs rather than weighting by spend", async () => {
    // The mean of `unitCost` across the lines, not spend over quantity. Two lines
    // at 5 and 7 average to 6, not to 85/15.
    seedProductLines([
      lineFixture({ quantity: 10, unitCost: 5, totalCost: 50 }),
      lineFixture({ quantity: 5, unitCost: 7, totalCost: 35 }),
    ]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body[0].averageUnitCost).toBe(6);
  });

  it("sorts by spend, highest first", async () => {
    seedProductLines([
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
    seedProductLines([]);

    const res = await asTenant(
      request(app).get("/api/reports/purchase/by-product")
    );

    expect(res.body).toEqual([]);
  });

  it("aggregates lines in the database rather than loading every one", async () => {
    seedProductLines([lineFixture(), lineFixture({ productId: "prod_2" })]);

    await asTenant(request(app).get("/api/reports/purchase/by-product"));

    expect(purchaseItemModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["productId"],
        _count: { _all: true },
        orderBy: { _sum: { totalCost: "desc" } },
      })
    );
    expect(purchaseItemModel.findMany).not.toHaveBeenCalled();
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

    // The basic report loads documents; the by-supplier and by-product reports
    // aggregate in the database. The window has to reach all three, wherever the
    // arithmetic happens.
    for (const call of purchaseModel.findMany.mock.calls) {
      expect(call[0].where.purchaseDate).toMatchObject({
        gte: new Date("2026-03-01"),
        lte: new Date("2026-03-31"),
      });
    }

    expect(purchaseModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purchaseDate: { gte: new Date("2026-03-01"), lte: new Date("2026-03-31") },
        }),
      })
    );

    const productGroups = purchaseItemModel.groupBy.mock.calls.filter(
      (call) => call[0].by[0] === "productId"
    );

    expect(productGroups[0][0].where.purchase.purchaseDate).toMatchObject({
      gte: new Date("2026-03-01"),
    });
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
