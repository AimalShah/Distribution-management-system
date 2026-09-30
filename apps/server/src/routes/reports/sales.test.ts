import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { ORGANIZATION_HEADER } from "../../middleware/auth-context";

const { saleModel, saleItemModel, customerModel, productModel, dbStub } =
  vi.hoisted(() => {
    const sale = {
      findMany: vi.fn(),
      // The by-customer report counts and sums in the database rather than
      // loading every sale in the window and folding it in JavaScript.
      groupBy: vi.fn(),
    };
    const saleItem = {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    };
    // The grouped reports look the display fields up for the keys they grouped
    // on, in a second scoped query.
    const customer = { findMany: vi.fn() };
    const product = { findMany: vi.fn() };

    return {
      saleModel: sale,
      saleItemModel: saleItem,
      customerModel: customer,
      productModel: product,
      dbStub: { $transaction: vi.fn(), sale, saleItem, customer, product },
    };
  });

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_other";

const asTenant = (req: request.Test, organizationId = ORG) =>
  req.set(ORGANIZATION_HEADER, organizationId);

const saleFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "sale_1",
  saleCode: "INV-001",
  saleDate: new Date("2026-04-10T00:00:00.000Z"),
  totalAmount: 300,
  status: "Completed",
  customerId: "cus_1",
  customer: {
    name: "Acme Retail",
    customerCode: "C-001",
    isActive: true,
  },
  ...overrides,
});

const lineFixture = (overrides: Record<string, unknown> = {}) => ({
  productId: "prod_1",
  quantity: 4,
  unitPrice: 75,
  totalPrice: 300,
  product: { name: "Widget", productCode: "W-001", unit: "pcs" },
  ...overrides,
});

// `getBasicSalesReport` runs two grouped sums over SaleItem — quantities, then
// line subtotals — and they are distinguished by the column being summed rather
// than by call order. `mockResolvedValueOnce` would be the obvious way, but
// `vi.clearAllMocks()` does not drain the once-queue, so any test that made
// fewer than two calls left its values to poison the next one.
//
// Each row carries its `saleId`, because Prisma returns the `by` columns on
// every grouped row and the service keys both sums by it.
//
// `_count` is how the number of lines is counted, and it is not decoration: the
// groups are keyed on `saleId`, so there is one group per invoice that has a line
// rather than one per line. `lineCounts` says how many lines each of those
// invoices has, and defaults to one so the callers that do not care about it stay
// short.
type SaleLineGroups = {
  quantities: Record<string, number>;
  subtotals: Record<string, number>;
  lineCounts?: Record<string, number>;
};

const mockSaleLineGroups = ({ quantities, subtotals, lineCounts }: SaleLineGroups) =>
  saleItemModel.groupBy.mockImplementation(
    (args: { by: string[]; _sum: Record<string, boolean> }) => {
      // Three reports share this model and two different grouping keys: the basic
      // report by saleId, the by-product report by productId. Dispatch on the key
      // first, then on the column being summed.
      if (args.by[0] === "productId") {
        return Promise.resolve([]);
      }

      const column = Object.keys(args._sum)[0];
      const source = column === "quantity" ? quantities : subtotals;
      return Promise.resolve(
        Object.entries(source).map(([saleId, value]) => ({
          saleId,
          _count: { _all: lineCounts?.[saleId] ?? 1 },
          _sum: { [column]: value },
        }))
      );
    }
  );

// Seed the grouped reports. `rows` are raw line records; what comes back is the
// aggregate the database would have produced for them.
const seedCustomerGroups = (rows: Record<string, unknown>[]) => {
  const byCustomer = new Map<string, { orders: number; total: number }>();
  for (const row of rows) {
    const id = row.customerId as string;
    const bucket = byCustomer.get(id) ?? { orders: 0, total: 0 };
    bucket.orders += 1;
    bucket.total += row.totalAmount as number;
    byCustomer.set(id, bucket);
  }
  return [...byCustomer.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([customerId, bucket]) => ({
      customerId,
      _count: { _all: bucket.orders },
      _sum: { totalAmount: bucket.total },
    }));
};

const seedProductGroups = (rows: Record<string, unknown>[]) => {
  const byProduct = new Map<
    string,
    { quantity: number; totalPrice: number; priceSum: number; lines: number }
  >();
  for (const row of rows) {
    const id = row.productId as string;
    const bucket = byProduct.get(id) ?? {
      quantity: 0,
      totalPrice: 0,
      priceSum: 0,
      lines: 0,
    };
    bucket.quantity += row.quantity as number;
    bucket.totalPrice += row.totalPrice as number;
    bucket.priceSum += row.unitPrice as number;
    bucket.lines += 1;
    byProduct.set(id, bucket);
  }
  return [...byProduct.entries()]
    .sort((a, b) => b[1].totalPrice - a[1].totalPrice)
    .map(([productId, bucket]) => ({
      productId,
      _count: { _all: bucket.lines },
      _sum: {
        quantity: bucket.quantity,
        totalPrice: bucket.totalPrice,
        unitPrice: bucket.priceSum,
      },
    }));
};

const seedSaleProductGroups = (rows: Record<string, unknown>[]) => {
  saleItemModel.groupBy.mockImplementation(
    (args: { by: string[]; _sum: Record<string, boolean> }) => {
      if (args.by[0] === "productId") {
        return Promise.resolve(seedProductGroups(rows));
      }
      const column = Object.keys(args._sum)[0];
      const source =
        column === "quantity" ? { sale_1: 4 } : { sale_1: 300 };
      return Promise.resolve(
        Object.entries(source).map(([saleId, value]) => ({
          saleId,
          // The basic report reads the line count off the same rows, so a group
          // without one leaves it summing `undefined`.
          _count: { _all: 1 },
          _sum: { [column]: value },
        }))
      );
    }
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  saleModel.findMany.mockResolvedValue([saleFixture()]);
  saleItemModel.findMany.mockResolvedValue([lineFixture()]);
  saleModel.groupBy.mockResolvedValue([]);
  customerModel.findMany.mockResolvedValue([
    { id: "cus_1", name: "Acme Retail", customerCode: "C-001", isActive: true },
    { id: "cus_2", name: "Acme Retail", customerCode: "C-002", isActive: false },
  ]);
  productModel.findMany.mockResolvedValue([
    { id: "prod_1", name: "Widget", productCode: "W-001", unit: "pcs" },
    { id: "prod_2", name: "Widget", productCode: "W-002", unit: "pcs" },
  ]);
  mockSaleLineGroups({
    quantities: { sale_1: 4 },
    subtotals: { sale_1: 300 },
  });
});

describe("org scoping", () => {
  it.each([["basic"], ["by-customer"], ["by-product"], ["full"]])(
    "scopes GET /api/reports/sales/%s to the tenant",
    async (report) => {
      // None of the three legacy functions took an organization, so every
      // tenant saw every other tenant's revenue, customers and products.
      await asTenant(request(app).get(`/api/reports/sales/${report}`));

      for (const call of saleModel.findMany.mock.calls) {
        expect(call[0].where).toMatchObject({ organizationId: ORG });
      }
    }
  );

  it("scopes sale lines through the sale relation", async () => {
    // SaleItem has no organizationId column, so the tenant has to be reached
    // through `sale` or the filter scopes to nothing. The by-product report groups
    // its lines in the database, so the predicate under test is the `groupBy` one.
    await asTenant(request(app).get("/api/reports/sales/by-product"));

    const calls = saleItemModel.groupBy.mock.calls.filter(
      (call) => call[0].by[0] === "productId"
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][0].where).toMatchObject({ sale: { organizationId: ORG } });
  });

  it("scopes the line sums through the sale relation", async () => {
    await asTenant(request(app).get("/api/reports/sales/basic"));

    for (const call of saleItemModel.groupBy.mock.calls) {
      expect(call[0].where).toMatchObject({ sale: { organizationId: ORG } });
    }
  });

  it("reads the tenant the header names", async () => {
    await asTenant(request(app).get("/api/reports/sales/basic"), OTHER_ORG);

    expect(saleModel.findMany.mock.calls[0][0].where.organizationId).toBe(
      OTHER_ORG
    );
  });

  it("400s without a tenant header", async () => {
    const res = await request(app).get("/api/reports/sales/basic");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });
});

describe("GET /api/reports/sales/basic", () => {
  it("totals the window", async () => {
    saleModel.findMany.mockResolvedValue([
      saleFixture(),
      saleFixture({
        id: "sale_2",
        saleDate: new Date("2026-04-11T00:00:00.000Z"),
        totalAmount: 120,
        customerId: "cus_2",
      }),
    ]);
    mockSaleLineGroups({
      quantities: { sale_1: 4, sale_2: 2 },
      subtotals: { sale_1: 300, sale_2: 120 },
    });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalSales: 420,
      totalLineSubtotal: 420,
      totalOrders: 2,
      uniqueCustomers: 2,
      totalLineItems: 2,
      totalQuantity: 6,
      unreconciledOrders: 0,
    });
  });

  it("counts line items, not units, under its own name", async () => {
    // The legacy reported `sales.reduce((s, sale) => s + sale.items.length, 0)`
    // as "totalItems" beside a quantity. A reader takes that for units sold, and
    // one line for 500 units counts as one.
    mockSaleLineGroups({
      quantities: { sale_1: 500 },
      subtotals: { sale_1: 300 },
    });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.totalLineItems).toBe(1);
    expect(res.body.totalQuantity).toBe(500);
    expect(res.body).not.toHaveProperty("totalItems");
  });

  it("counts the lines on an invoice, not the invoices that have lines", async () => {
    // The groups are keyed on `saleId`, so one group is one invoice however many
    // lines it has. Reading the group count answered `totalOrders` again under a
    // name that promises lines, which is the confusion the rename was meant to
    // end: three lines on one invoice is three lines.
    mockSaleLineGroups({
      quantities: { sale_1: 4, sale_2: 1 },
      subtotals: { sale_1: 300, sale_2: 50 },
      lineCounts: { sale_1: 3, sale_2: 1 },
    });
    saleModel.findMany.mockResolvedValue([
      saleFixture(),
      saleFixture({ id: "sale_2", totalAmount: 50 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.totalLineItems).toBe(4);
    expect(res.body.totalOrders).toBe(2);
    expect(res.body.totalQuantity).toBe(5);
  });

  it("counts an invoice whose header disagrees with its own lines", async () => {
    // `createInvoice` writes `totalAmount` straight from the request body and
    // never recomputes it, so a header can disagree with its lines by any
    // amount. The legacy reported the header and the line subtotal was never
    // looked at, so the disagreement was invisible.
    saleModel.findMany.mockResolvedValue([
      saleFixture({ totalAmount: 500 }),
      saleFixture({ id: "sale_2", totalAmount: 120 }),
    ]);
    mockSaleLineGroups({
      quantities: { sale_1: 4, sale_2: 2 },
      subtotals: { sale_1: 300, sale_2: 120 },
    });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.totalSales).toBe(620);
    expect(res.body.totalLineSubtotal).toBe(420);
    expect(res.body.unreconciledOrders).toBe(1);
  });

  it("does not count a header that matches its lines to the cent", async () => {
    // Float money: 0.1 + 0.2 style drift is not a disagreement.
    saleModel.findMany.mockResolvedValue([
      saleFixture({ totalAmount: 300.004 }),
    ]);
    mockSaleLineGroups({
      quantities: { sale_1: 4 },
      subtotals: { sale_1: 300 },
    });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.unreconciledOrders).toBe(0);
  });

  it("does not count a sale with no lines as unreconciled", async () => {
    // An invoice with no lines has nothing to disagree with; counting it would
    // report a mismatch that is really just an empty invoice.
    saleModel.findMany.mockResolvedValue([saleFixture()]);
    mockSaleLineGroups({ quantities: {}, subtotals: {} });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.unreconciledOrders).toBe(0);
    expect(res.body.totalLineItems).toBe(0);
  });

  it("buckets daily totals by the stored calendar day, in order", async () => {
    saleModel.findMany.mockResolvedValue([
      saleFixture({
        id: "sale_2",
        saleDate: new Date("2026-04-09T00:00:00.000Z"),
        totalAmount: 90,
      }),
      saleFixture(),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.dailyTotals).toEqual([
      { date: "2026-04-09", total: 90 },
      { date: "2026-04-10", total: 300 },
    ]);
  });

  it("adds same-day invoices into one daily total", async () => {
    saleModel.findMany.mockResolvedValue([
      saleFixture(),
      saleFixture({ id: "sale_2", totalAmount: 20 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.dailyTotals).toEqual([{ date: "2026-04-10", total: 320 }]);
  });

  it("reports the status split rather than adding pending into completed", async () => {
    saleModel.findMany.mockResolvedValue([
      saleFixture(),
      saleFixture({ id: "sale_2", totalAmount: 60, status: "Pending" }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.totalSales).toBe(360);
    expect(res.body.byStatus).toEqual([
      { status: "Completed", orders: 1, totalAmount: 300 },
      { status: "Pending", orders: 1, totalAmount: 60 },
    ]);
  });

  it("reads a sale with no status as Unspecified", async () => {
    // The column is `String` with a comment, not an enum, and nothing defaults
    // it, so an empty status is reachable.
    saleModel.findMany.mockResolvedValue([saleFixture({ status: "" })]);

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body.byStatus).toEqual([
      { status: "Unspecified", orders: 1, totalAmount: 300 },
    ]);
  });

  it("returns zeros for a window with no sales", async () => {
    saleModel.findMany.mockResolvedValue([]);
    mockSaleLineGroups({ quantities: {}, subtotals: {} });

    const res = await asTenant(request(app).get("/api/reports/sales/basic"));

    expect(res.body).toMatchObject({
      totalSales: 0,
      totalLineSubtotal: 0,
      totalOrders: 0,
      uniqueCustomers: 0,
      totalLineItems: 0,
      totalQuantity: 0,
      unreconciledOrders: 0,
      dailyTotals: [],
      byStatus: [],
    });
  });
});

describe("GET /api/reports/sales/basic date window", () => {
  it("passes a supplied window to the query", async () => {
    await asTenant(
      request(app).get(
        "/api/reports/sales/basic?startDate=2026-04-01&endDate=2026-04-30"
      )
    );

    expect(saleModel.findMany.mock.calls[0][0].where.saleDate).toMatchObject({
      gte: new Date("2026-04-01"),
      lte: new Date("2026-04-30"),
    });
  });

  it("sends no saleDate filter at all when no window is given", async () => {
    await asTenant(request(app).get("/api/reports/sales/basic"));

    // The legacy built `{ gte: new Date(undefined), lte: new Date(undefined) }`
    // when the params were missing, which is an Invalid Date, and every
    // `saleDate >= Invalid Date` is false — so an unfiltered call silently
    // reported nothing at all.
    expect(saleModel.findMany.mock.calls[0][0].where).not.toHaveProperty(
      "saleDate"
    );
  });

  it("applies only the bound that was given", async () => {
    await asTenant(
      request(app).get("/api/reports/sales/basic?endDate=2026-04-30")
    );

    expect(saleModel.findMany.mock.calls[0][0].where.saleDate).toEqual({
      lte: new Date("2026-04-30"),
    });
  });

  it("400s an unparseable date instead of returning nothing", async () => {
    const res = await asTenant(
      request(app).get("/api/reports/sales/basic?endDate=nope")
    );

    expect(res.status).toBe(400);
  });

  it("400s a reversed window", async () => {
    const res = await asTenant(
      request(app).get(
        "/api/reports/sales/basic?startDate=2026-04-30&endDate=2026-04-01"
      )
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /api/reports/sales/by-customer", () => {
  // Seeded on `groupBy`: the report counts and sums in the database, so what it
  // reads is already aggregated. The expected rows are unchanged.

  it("keeps two customers that share a name apart", async () => {
    // The legacy keyed the accumulator on customer.name, so same-named
    // customers merged into one row with their revenue added together.
    saleModel.groupBy.mockResolvedValue(
      seedCustomerGroups([
        saleFixture(),
        saleFixture({ id: "sale_2", customerId: "cus_2", totalAmount: 100 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/sales/by-customer")
    );

    expect(res.body).toHaveLength(2);
    expect(res.body.map((r: { customerId: string }) => r.customerId).sort()).toEqual(
      ["cus_1", "cus_2"]
    );
  });

  it("adds repeat invoices for one customer", async () => {
    saleModel.groupBy.mockResolvedValue(
      seedCustomerGroups([
        saleFixture(),
        saleFixture({ id: "sale_2", totalAmount: 100 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/sales/by-customer")
    );

    expect(res.body).toEqual([
      {
        customerId: "cus_1",
        name: "Acme Retail",
        customerCode: "C-001",
        isActive: true,
        orders: 2,
        totalAmount: 400,
      },
    ]);
  });

  it("does not load the invoice lines or whole product rows", async () => {
    // The legacy `include`d `items: { include: { product: true } }` and
    // `customer: true`, then read neither the items nor anything but the name
    // off the customer. Now nothing but the group keys and sums is read from the
    // sales themselves, and the display fields come from one scoped lookup.
    await asTenant(request(app).get("/api/reports/sales/by-customer"));

    expect(saleModel.findMany).not.toHaveBeenCalled();
    expect(saleModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["customerId"],
        _count: { _all: true },
        orderBy: { _sum: { totalAmount: "desc" } },
      })
    );
    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, name: true, customerCode: true, isActive: true },
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
  });

  it("sorts by revenue, highest first", async () => {
    saleModel.groupBy.mockResolvedValue(
      seedCustomerGroups([
        saleFixture({ customerId: "cus_1", totalAmount: 10 }),
        saleFixture({ customerId: "cus_2", totalAmount: 900 }),
      ])
    );

    const res = await asTenant(
      request(app).get("/api/reports/sales/by-customer")
    );

    expect(res.body.map((r: { customerId: string }) => r.customerId)).toEqual([
      "cus_2",
      "cus_1",
    ]);
  });

  it("returns an empty list when nothing was sold", async () => {
    saleModel.groupBy.mockResolvedValue([]);

    const res = await asTenant(
      request(app).get("/api/reports/sales/by-customer")
    );

    expect(res.body).toEqual([]);
  });

  it("scopes the group and the name lookup to the tenant", async () => {
    saleModel.groupBy.mockResolvedValue(seedCustomerGroups([saleFixture()]));

    await asTenant(request(app).get("/api/reports/sales/by-customer"));

    expect(saleModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
    // The second query must be scoped too, or a customer key resolves to another
    // tenant's name.
    expect(customerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
  });
});

describe("GET /api/reports/sales/by-product", () => {
  // Seeded on `groupBy`, as the customer report above.

  it("keeps two products that share a name apart", async () => {
    seedSaleProductGroups([
      lineFixture({ productId: "prod_1" }),
      lineFixture({ productId: "prod_2", totalPrice: 30 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body.map((r: { productId: string }) => r.productId).sort()).toEqual(
      ["prod_1", "prod_2"]
    );
  });

  it("adds quantities and revenue across lines", async () => {
    seedSaleProductGroups([
      lineFixture({ quantity: 4, unitPrice: 75, totalPrice: 300 }),
      lineFixture({ quantity: 2, unitPrice: 60, totalPrice: 120 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body).toEqual([
      {
        productId: "prod_1",
        name: "Widget",
        productCode: "W-001",
        unit: "pcs",
        quantity: 6,
        totalPrice: 420,
        averageUnitPrice: 67.5,
      },
    ]);
  });

  it("carries quantity so 1 at 1000 and 1000 at 1 are distinguishable", async () => {
    seedSaleProductGroups([
      lineFixture({ quantity: 1, unitPrice: 1000, totalPrice: 1000 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body[0]).toMatchObject({ quantity: 1, averageUnitPrice: 1000 });
  });

  it("averages the line prices rather than weighting by revenue", async () => {
    // The mean of `unitPrice` across the lines, not revenue over quantity. Two
    // lines at 75 and 60 average to 67.5, not to 420/6.
    seedSaleProductGroups([
      lineFixture({ quantity: 4, unitPrice: 75, totalPrice: 300 }),
      lineFixture({ quantity: 2, unitPrice: 60, totalPrice: 120 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body[0].averageUnitPrice).toBe(67.5);
  });

  it("sorts by revenue, highest first", async () => {
    seedSaleProductGroups([
      lineFixture({ productId: "prod_1", totalPrice: 10 }),
      lineFixture({ productId: "prod_2", totalPrice: 900 }),
    ]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body.map((r: { productId: string }) => r.productId)).toEqual([
      "prod_2",
      "prod_1",
    ]);
  });

  it("returns an empty list when nothing was sold", async () => {
    seedSaleProductGroups([]);

    const res = await asTenant(request(app).get("/api/reports/sales/by-product"));

    expect(res.body).toEqual([]);
  });

  it("aggregates lines in the database rather than loading every one", async () => {
    seedSaleProductGroups([lineFixture(), lineFixture({ productId: "prod_2" })]);

    await asTenant(request(app).get("/api/reports/sales/by-product"));

    const productGroups = saleItemModel.groupBy.mock.calls.filter(
      (call) => call[0].by[0] === "productId"
    );
    expect(productGroups[0][0]).toMatchObject({
      by: ["productId"],
      _count: { _all: true },
      orderBy: { _sum: { totalPrice: "desc" } },
    });
    expect(saleItemModel.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/sales/full", () => {
  it("returns all three reports", async () => {
    const res = await asTenant(request(app).get("/api/reports/sales/full"));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("basic");
    expect(res.body).toHaveProperty("byCustomer");
    expect(res.body).toHaveProperty("byProduct");
  });

  it("agrees with the individual reports", async () => {
    const res = await asTenant(request(app).get("/api/reports/sales/full"));

    const basic = await asTenant(request(app).get("/api/reports/sales/basic"));
    const byCustomer = await asTenant(
      request(app).get("/api/reports/sales/by-customer")
    );
    const byProduct = await asTenant(
      request(app).get("/api/reports/sales/by-product")
    );

    expect(res.body.basic).toEqual(basic.body);
    expect(res.body.byCustomer).toEqual(byCustomer.body);
    expect(res.body.byProduct).toEqual(byProduct.body);
  });

  it("passes its window to all three", async () => {
    await asTenant(
      request(app).get(
        "/api/reports/sales/full?startDate=2026-04-01&endDate=2026-04-30"
      )
    );

    // The basic report loads documents; the by-customer and by-product reports
    // aggregate in the database. The window has to reach all three, wherever the
    // arithmetic happens.
    for (const call of saleModel.findMany.mock.calls) {
      expect(call[0].where.saleDate).toMatchObject({
        gte: new Date("2026-04-01"),
        lte: new Date("2026-04-30"),
      });
    }

    expect(saleModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          saleDate: { gte: new Date("2026-04-01"), lte: new Date("2026-04-30") },
        }),
      })
    );

    const productGroups = saleItemModel.groupBy.mock.calls.filter(
      (call) => call[0].by[0] === "productId"
    );
    expect(productGroups[0][0].where.sale.saleDate).toMatchObject({
      gte: new Date("2026-04-01"),
    });
  });

  it("400s a bad window like the others", async () => {
    const res = await asTenant(
      request(app).get(
        "/api/reports/sales/full?startDate=2026-04-30&endDate=2026-04-01"
      )
    );

    expect(res.status).toBe(400);
  });
});
