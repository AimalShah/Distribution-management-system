/**
 * Checkpoint 2n — Purchase Reports API: Parity Test
 *
 * Four reports over the same table, and the arithmetic is the whole point. The
 * legacy accumulated these totals in JavaScript, in a plain object, keyed on a
 * *display name* — so two suppliers trading as "Acme" became one row, and
 * `totalItems` counted order lines while sitting next to a number of units as
 * though both meant the same thing. A mocked `findMany` reproduces every one of
 * those answers exactly, because the bugs are in the loop and not in the query.
 *
 * The fixtures are therefore built so that the wrong answers are different from
 * the right ones: two suppliers sharing a company name, two products sharing a
 * name, one purchase with two lines, one purchase whose header total differs
 * from its line totals, and a purchase dated in 2001 that a window excludes and
 * no window includes.
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

/** The window every scoped assertion uses. The ancient purchase falls outside it. */
const WINDOW = {
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-12-31T23:59:59.999Z",
};

const window = `?startDate=${WINDOW.startDate}&endDate=${WINDOW.endDate}`;

const at = (iso: string) => new Date(iso);

describe.skipIf(!hasDatabase)("Checkpoint 2n — Purchase Reports API", () => {
  let t: Tenant;

  /** Suppliers created here, keyed by label. `seeded` is the one `seedTenants` made. */
  const suppliers: Record<string, string> = { seeded: "" };
  /** Products created here, keyed by label. */
  const products: Record<string, string> = { seeded: "" };

  beforeAll(async () => {
    t = await seedTenants();
    suppliers.seeded = t.supplierId;
    products.seeded = t.productId;

    const mine = t.organizationId;

    // Two suppliers that trade under the same name. `Purchase.supplierId` is the
    // key; `companyName` is a display field, and keying the accumulator on it is
    // what merged these two into one row.
    suppliers.acme = await makeSupplier(mine, "Acme", "A");
    suppliers.acmeTwin = await makeSupplier(mine, "Acme", "B");
    // Bought from only outside the window, so the windowless report has a row the
    // windowed one must not.
    suppliers.ancient = await makeSupplier(mine, "Ancient Co", "C");

    // Two products sharing a name, for the same reason on the product side.
    products.widget = await makeProduct(mine, "widget", 10);
    products.widgetTwin = await makeProduct(mine, "widget", 30);
    products.ancient = await makeProduct(mine, "ancient", 10);

    await makePurchase({
      // Two lines of the same product, so a line count and an order count differ.
      label: "two-lines",
      supplierId: suppliers.seeded,
      organizationId: mine,
      purchaseDate: at("2026-03-10T09:00:00.000Z"),
      status: "Completed",
      // Matches its line totals, so the header and the lines cannot be confused.
      totalAmount: 120,
      items: [
        { productId: products.seeded, quantity: 10, unitCost: 5, totalCost: 50 },
        { productId: products.seeded, quantity: 10, unitCost: 7, totalCost: 70 },
      ],
    });

    await makePurchase({
      // Shares 10 March with the purchase above, so the daily bucket has to add
      // two orders together rather than overwrite one with the other.
      label: "same-day",
      supplierId: suppliers.seeded,
      organizationId: mine,
      purchaseDate: at("2026-03-10T16:30:00.000Z"),
      status: "Completed",
      totalAmount: 50,
      items: [{ productId: products.widget, quantity: 1, unitCost: 50, totalCost: 50 }],
    });

    await makePurchase({
      // Pending, so the status split has something on each side, and the only
      // purchase of this supplier inside the window.
      label: "pending",
      supplierId: suppliers.acme,
      organizationId: mine,
      purchaseDate: at("2026-05-20T12:00:00.000Z"),
      status: "Pending",
      totalAmount: 80,
      items: [{ productId: products.widget, quantity: 8, unitCost: 10, totalCost: 80 }],
    });

    await makePurchase({
      // The other "Acme". Also the only purchase naming the second "widget".
      label: "twin",
      supplierId: suppliers.acmeTwin,
      organizationId: mine,
      purchaseDate: at("2026-06-15T08:00:00.000Z"),
      status: "Completed",
      totalAmount: 120,
      items: [
        { productId: products.widget, quantity: 6, unitCost: 10, totalCost: 60 },
        { productId: products.widgetTwin, quantity: 2, unitCost: 30, totalCost: 60 },
      ],
    });

    await makePurchase({
      // The header total is 200 while its single line is 180, so the two reports
      // that read those different columns cannot be checked against each other.
      label: "freight",
      supplierId: suppliers.acme,
      organizationId: mine,
      purchaseDate: at("2026-07-01T10:00:00.000Z"),
      status: "Completed",
      totalAmount: 200,
      items: [{ productId: products.seeded, quantity: 20, unitCost: 9, totalCost: 180 }],
    });

    await makePurchase({
      // Outside every window used above.
      label: "ancient",
      supplierId: suppliers.ancient,
      organizationId: mine,
      purchaseDate: at("2001-03-01T00:00:00.000Z"),
      status: "Pending",
      totalAmount: 30,
      items: [{ productId: products.ancient, quantity: 3, unitCost: 10, totalCost: 30 }],
    });

    // The other tenant's spend: larger than everything above, so a report that
    // reads across tenants is unmissable rather than subtle.
    await makePurchase({
      label: "theirs",
      supplierId: t.otherSupplierId,
      organizationId: t.otherOrganizationId,
      purchaseDate: at("2026-04-04T00:00:00.000Z"),
      status: "Completed",
      totalAmount: 999,
      items: [
        { productId: t.otherProductId, quantity: 999, unitCost: 1, totalCost: 999 },
      ],
    });
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const makeSupplier = async (
    organizationId: string,
    companyName: string,
    contactPerson: string
  ) => {
    const row = await prisma.supplier.create({
      data: {
        id: `sup_${unique(companyName)}`,
        // Required and unique across the installation, not per tenant.
        supplierCode: unique("SUP"),
        organizationId,
        companyName,
        contactPerson,
      },
      select: { id: true },
    });

    return row.id;
  };

  const makeProduct = async (orgId: string, name: string, unitCost: number) => {
    const id = `prd_${unique(name)}`;
    await prisma.product.create({
      data: {
        id,
        productCode: unique("SKU"),
        organizationId: orgId,
        name,
        unit: "pcs",
        unitCost,
        unitPrice: unitCost * 2,
        categoryId: orgId === t.organizationId ? t.categoryId : t.otherCategoryId,
        brandId: orgId === t.organizationId ? t.brandId : t.otherBrandId,
      },
    });

    return id;
  };

  const makePurchase = async ({
    label,
    supplierId,
    organizationId,
    purchaseDate,
    status,
    totalAmount,
    items,
  }: {
    label: string;
    supplierId: string;
    organizationId: string;
    purchaseDate: Date;
    status: string;
    totalAmount: number;
    items: { productId: string; quantity: number; unitCost: number; totalCost: number }[];
  }) => {
    const id = `pur_${unique(label)}`;
    await prisma.purchase.create({
      data: {
        id,
        purchaseCode: unique("PO"),
        organizationId,
        supplierId,
        totalAmount,
        status,
        purchaseDate,
        createdAt: purchaseDate,
      },
    });

    for (const item of items) {
      await prisma.purchaseItem.create({
        data: { id: `pit_${unique("item")}`, purchaseId: id, ...item },
      });
    }

    return id;
  };

  const basic = (orgId: string, query = "") =>
    request(app).get(`/api/reports/purchase/basic${query}`).set(asOrg(orgId));

  const bySupplier = (orgId: string, query = "") =>
    request(app).get(`/api/reports/purchase/by-supplier${query}`).set(asOrg(orgId));

  const byProduct = (orgId: string, query = "") =>
    request(app).get(`/api/reports/purchase/by-product${query}`).set(asOrg(orgId));

  const full = (orgId: string, query = "") =>
    request(app).get(`/api/reports/purchase/full${query}`).set(asOrg(orgId));

  it("totals the window's purchases, orders, suppliers and units", async () => {
    const res = await basic(t.organizationId, window);

    expect(res.status).toBe(200);
    // 120 + 50 + 80 + 120 + 200.
    expect(res.body.totalPurchaseAmount).toBe(570);
    expect(res.body.totalOrders).toBe(5);
    // Seeded supplier, "Acme", and the other "Acme" — three ids, two names.
    expect(res.body.uniqueSuppliers).toBe(3);
    // Units, counted off the lines: 20 + 1 + 8 + 8 + 20.
    expect(res.body.totalQuantity).toBe(57);
  });

  it("counts order lines rather than orders", async () => {
    // 2 + 1 + 1 + 2 + 1. The purchase with two lines is the whole reason this can
    // differ from `totalOrders`, and a count of lines was the point of renaming the
    // legacy's `totalItems`: five orders are not seven lines, and neither number is
    // 57.
    const res = await basic(t.organizationId, window);

    expect(res.body.totalLineItems).toBe(7);
    expect(res.body.totalLineItems).not.toBe(res.body.totalOrders);
  });

  it("buckets spend by the day the purchase was made on", async () => {
    const res = await basic(t.organizationId, window);

    // Two purchases on 10 March, added together rather than one replacing the
    // other, and the buckets in date order.
    expect(res.body.dailyTotals).toEqual([
      { date: "2026-03-10", total: 170 },
      { date: "2026-05-20", total: 80 },
      { date: "2026-06-15", total: 120 },
      { date: "2026-07-01", total: 200 },
    ]);
  });

  it("breaks the total down by status instead of mixing them", async () => {
    const res = await basic(t.organizationId, window);

    // The status column is free text and no report filtered on it, so a pending
    // order used to land in the same "total purchase amount" as a completed one
    // with nothing to say so.
    expect(res.body.byStatus).toEqual([
      { status: "Completed", orders: 4, totalAmount: 490 },
      { status: "Pending", orders: 1, totalAmount: 80 },
    ]);

    const completed = res.body.byStatus.find(
      (s: { status: string }) => s.status === "Completed"
    );

    expect(completed.totalAmount).toBeLessThan(res.body.totalPurchaseAmount);
  });

  it("excludes purchases outside the window", async () => {
    const res = await basic(t.organizationId, window);

    expect(res.body.dailyTotals.map((d: { date: string }) => d.date)).not.toContain(
      "2001-03-01"
    );
    expect(res.body.totalPurchaseAmount).toBeLessThan(600);
  });

  it("includes every purchase when no window is given", async () => {
    // The legacy did `new Date(undefined)` — an Invalid Date — and then compared
    // it, so `purchaseDate >= Invalid Date` was false for every row and the report
    // came back empty. A tenant with no window asked for its whole history, not
    // none of it.
    const res = await basic(t.organizationId);

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(6);
    expect(res.body.totalPurchaseAmount).toBe(600);
    expect(res.body.dailyTotals.map((d: { date: string }) => d.date)).toContain(
      "2001-03-01"
    );
  });

  it("rejects a window that ends before it starts", async () => {
    // Which returned the empty set for the same reason an unparseable one did.
    const res = await basic(
      t.organizationId,
      "?startDate=2026-12-31T00:00:00.000Z&endDate=2026-01-01T00:00:00.000Z"
    );

    expect(res.status).toBe(400);
  });

  it("rejects a date that is not a date", async () => {
    const res = await basic(t.organizationId, "?startDate=last-tuesday");

    expect(res.status).toBe(400);
  });

  it("adds up spend per supplier without merging names", async () => {
    const res = await bySupplier(t.organizationId, window);

    expect(res.status).toBe(200);
    // Biggest spend first: "Acme" at 280, the seeded supplier at 170, the other
    // "Acme" at 120.
    expect(res.body).toEqual([
      {
        supplierId: suppliers.acme,
        companyName: "Acme",
        orders: 2,
        totalAmount: 280,
      },
      {
        supplierId: suppliers.seeded,
        companyName: "Parity Supplier",
        orders: 2,
        totalAmount: 170,
      },
      {
        supplierId: suppliers.acmeTwin,
        companyName: "Acme",
        orders: 1,
        totalAmount: 120,
      },
    ]);
  });

  it("keeps two suppliers trading under one name apart", async () => {
    // The legacy accumulated into an object keyed on `companyName`, so these two
    // arrived as a single row with 400 added together, and the purchase count went
    // with them. They are two suppliers.
    const res = await bySupplier(t.organizationId, window);

    const acmes = res.body.filter((r: { companyName: string }) => r.companyName === "Acme");
    expect(acmes).toHaveLength(2);
    expect(new Set(acmes.map((r: { supplierId: string }) => r.supplierId)).size).toBe(2);
    expect(acmes.reduce((sum: number, r: { totalAmount: number }) => sum + r.totalAmount, 0)).toBe(
      400
    );
  });

  it("does not report a supplier bought from before the window", async () => {
    const res = await bySupplier(t.organizationId, window);

    expect(res.body.map((r: { supplierId: string }) => r.supplierId)).not.toContain(
      suppliers.ancient
    );

    const all = await bySupplier(t.organizationId);
    expect(all.body.map((r: { supplierId: string }) => r.supplierId)).toContain(
      suppliers.ancient
    );
  });

  it("adds up quantity and cost per product without merging names", async () => {
    const res = await byProduct(t.organizationId, window);

    expect(res.status).toBe(200);
    // Most spend first: 300, 190, then 60.
    expect(res.body.map((r: { productId: string }) => r.productId)).toEqual([
      products.seeded,
      products.widget,
      products.widgetTwin,
    ]);

    const widget = res.body.find(
      (r: { productId: string }) => r.productId === products.widget
    );

    expect(widget.quantity).toBe(15);
    expect(widget.totalCost).toBe(190);
    expect(widget.unit).toBe("pcs");
    expect(widget.name).toBe("widget");
  });

  it("keeps two products sharing a name apart", async () => {
    const res = await byProduct(t.organizationId, window);

    const widgets = res.body.filter((r: { name: string }) => r.name === "widget");
    expect(widgets).toHaveLength(2);
    expect(new Set(widgets.map((r: { productId: string }) => r.productId)).size).toBe(2);
  });

  it("averages unit cost across lines, not weighted by quantity", async () => {
    // The seeded product was bought at 5, 7 and 9 across three lines, so the mean
    // of the three is 7. Weighting by quantity would give 300/40 = 7.5, which is a
    // different number and the one the legacy's loop happened to produce is *not*
    // the spend-weighted one either — this pins which of the two is being reported
    // so a change to it has to be deliberate.
    const res = await byProduct(t.organizationId, window);

    const seeded = res.body.find(
      (r: { productId: string }) => r.productId === products.seeded
    );

    expect(seeded.averageUnitCost).toBe(7);
    expect(seeded.totalCost).toBe(300);
    expect(seeded.quantity).toBe(40);

    // The "widget" line bought once at 50 and twice-eight units at 10: the mean of
    // the three line costs is 70/3, and the weighted figure would be 190/15.
    const widget = res.body.find(
      (r: { productId: string }) => r.productId === products.widget
    );

    expect(widget.averageUnitCost).toBeCloseTo(70 / 3, 6);
    expect(widget.averageUnitCost).not.toBeCloseTo(190 / 15, 3);
  });

  it("reads line costs and header totals from different columns", async () => {
    // One purchase is headed at 200 and its single line is 180. The basic report
    // reads the header and the product report reads the lines, so neither total is
    // the other's — a check that treated them as one number would pass here only
    // because the fixture happened to differ.
    const [basicRes, productRes] = await Promise.all([
      basic(t.organizationId, window),
      byProduct(t.organizationId, window),
    ]);

    // 570 across five headers, 550 across seven lines: the 200 gap is the freight
    // on the one purchase whose header does not match its line.
    expect(basicRes.body.totalPurchaseAmount).toBe(570);

    const lineTotal = productRes.body.reduce(
      (sum: number, r: { totalCost: number }) => sum + r.totalCost,
      0
    );

    expect(lineTotal).toBe(550);
  });

  it("scopes every report to the caller's tenant", async () => {
    // The other tenant spent 999 on one order, more than this tenant spent on
    // five.
    const [basicRes, supplierRes, productRes] = await Promise.all([
      basic(t.organizationId, window),
      bySupplier(t.organizationId, window),
      byProduct(t.organizationId, window),
    ]);

    expect(basicRes.body.totalPurchaseAmount).toBe(570);
    expect(
      supplierRes.body.map((r: { supplierId: string }) => r.supplierId)
    ).not.toContain(t.otherSupplierId);
    expect(
      productRes.body.map((r: { productId: string }) => r.productId)
    ).not.toContain(t.otherProductId);
  });

  it("shows the other tenant its own purchases and nothing else", async () => {
    const [basicRes, productRes] = await Promise.all([
      basic(t.otherOrganizationId, window),
      byProduct(t.otherOrganizationId, window),
    ]);

    expect(basicRes.body.totalOrders).toBe(1);
    expect(basicRes.body.totalPurchaseAmount).toBe(999);
    expect(productRes.body.map((r: { productId: string }) => r.productId)).toEqual([
      t.otherProductId,
    ]);
  });

  it("returns all three reports together, each matching its own endpoint", async () => {
    const res = await full(t.organizationId, window);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "basic",
      "byProduct",
      "bySupplier",
      "generatedAt",
    ]);

    const [basicRes, supplierRes, productRes] = await Promise.all([
      basic(t.organizationId, window),
      bySupplier(t.organizationId, window),
      byProduct(t.organizationId, window),
    ]);

    expect(res.body.basic).toEqual(basicRes.body);
    expect(res.body.bySupplier).toEqual(supplierRes.body);
    expect(res.body.byProduct).toEqual(productRes.body);
  });

  it("needs a tenant, and says so", async () => {
    // The legacy report functions took no organization at all, so there was no
    // request that could not be answered.
    const res = await request(app).get("/api/reports/purchase/basic");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });
});
