/**
 * Checkpoint 2o — Sales Reports API: Parity Test
 *
 * The same three reports as the purchase set, over the same three mistakes, plus
 * one thing the sales side has that purchasing does not: `Sale.totalAmount` is
 * written straight from the request body and never recomputed from the lines, so
 * an invoice can disagree with itself by any amount. The legacy summed the
 * headers and reported the result as "total sales", so a wrong header was
 * indistinguishable from a real sale.
 *
 * So the fixtures put a header that disagrees with its own lines into the window,
 * one that disagrees by less than a cent, and one that is wrong in the other
 * direction — and the arithmetic is arranged so every wrong answer is a different
 * number from the right one.
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

const WINDOW = {
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-12-31T23:59:59.999Z",
};

const window = `?startDate=${WINDOW.startDate}&endDate=${WINDOW.endDate}`;

const at = (iso: string) => new Date(iso);

/** The header that disagrees with its own lines by a twentieth of a unit. */
const DRIFTING_HEADER = 100.001;

describe.skipIf(!hasDatabase)("Checkpoint 2o — Sales Reports API", () => {
  let t: Tenant;

  const customers: Record<string, string> = { seeded: "" };
  const products: Record<string, string> = { seeded: "" };

  beforeAll(async () => {
    t = await seedTenants();
    customers.seeded = t.customerId;
    products.seeded = t.productId;

    const mine = t.organizationId;

    // Two customers with one name between them.
    customers.zeta = await makeCustomer(mine, "Zeta Ltd", true);
    customers.zetaTwin = await makeCustomer(mine, "Zeta Ltd", true);
    // A customer who has stopped trading: the report carries the flag but does
    // not filter on it, because "who did we sell to" and "who may we sell to" are
    // different questions.
    customers.dormant = await makeCustomer(mine, "Dormant Ltd", false);
    // Bought from only outside the window.
    customers.ancient = await makeCustomer(mine, "Ancient Client", true);

    // Two products with one name between them, and one sold only outside the
    // window.
    products.gadget = await makeProduct(mine, "gadget", 30);
    products.gadgetTwin = await makeProduct(mine, "gadget", 40);
    products.relic = await makeProduct(mine, "relic", 20);

    await makeSale({
      label: "reconciled",
      customerId: customers.seeded,
      organizationId: mine,
      saleDate: at("2026-02-14T09:00:00.000Z"),
      status: "Completed",
      totalAmount: 180,
      items: [
        // Two lines of one product, at different prices, one of them for three
        // units — so the line count, the unit count and the revenue-weighted mean
        // are three different numbers.
        { productId: products.seeded, quantity: 1, unitPrice: 60, totalPrice: 60 },
        { productId: products.seeded, quantity: 3, unitPrice: 40, totalPrice: 120 },
      ],
    });

    await makeSale({
      // Shares 14 February with the sale above, so the daily bucket has to add
      // two invoices rather than one replacing the other.
      label: "same-day",
      customerId: customers.seeded,
      organizationId: mine,
      saleDate: at("2026-02-14T17:45:00.000Z"),
      status: "Pending",
      totalAmount: 200,
      items: [{ productId: products.gadget, quantity: 1, unitPrice: 200, totalPrice: 200 }],
    });

    await makeSale({
      // Headed at 50, worth 30. The whole point of `unreconciledOrders`.
      label: "drifting",
      customerId: customers.zeta,
      organizationId: mine,
      saleDate: at("2026-03-03T11:00:00.000Z"),
      status: "Completed",
      totalAmount: 50,
      items: [{ productId: products.gadget, quantity: 1, unitPrice: 30, totalPrice: 30 }],
    });

    await makeSale({
      // The other "Zeta Ltd", and the only sale of the second "gadget".
      label: "twin",
      customerId: customers.zetaTwin,
      organizationId: mine,
      saleDate: at("2026-04-04T13:20:00.000Z"),
      status: "Completed",
      totalAmount: 75,
      items: [
        { productId: products.gadgetTwin, quantity: 2, unitPrice: 37.5, totalPrice: 75 },
      ],
    });

    await makeSale({
      // Off by a thousandth. Whether that counts as unreconciled is a judgement,
      // and the threshold is the thing under test: floating point makes this
      // invoice wrong by a hair and the report has to say whether it noticed.
      label: "off-by-a-thousandth",
      customerId: customers.dormant,
      organizationId: mine,
      saleDate: at("2026-05-05T08:00:00.000Z"),
      status: "Completed",
      totalAmount: DRIFTING_HEADER,
      items: [{ productId: products.seeded, quantity: 1, unitPrice: 100, totalPrice: 100 }],
    });

    await makeSale({
      // Outside every window used above, and with no status at all, so the
      // "Unspecified" bucket has something in it without disturbing the windowed
      // figures.
      label: "ancient",
      customerId: customers.ancient,
      organizationId: mine,
      saleDate: at("2001-06-06T00:00:00.000Z"),
      status: "",
      totalAmount: 60,
      items: [{ productId: products.relic, quantity: 3, unitPrice: 20, totalPrice: 60 }],
    });

    // The other tenant's revenue: more than this tenant's whole window.
    await makeSale({
      label: "theirs",
      customerId: t.otherCustomerId,
      organizationId: t.otherOrganizationId,
      saleDate: at("2026-04-04T00:00:00.000Z"),
      status: "Completed",
      totalAmount: 9999,
      items: [
        { productId: t.otherProductId, quantity: 9999, unitPrice: 1, totalPrice: 9999 },
      ],
    });
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  const makeCustomer = async (
    organizationId: string,
    name: string,
    isActive: boolean
  ) => {
    const row = await prisma.customer.create({
      data: {
        id: `cus_${unique(name)}`,
        // Required and unique across the installation, not per tenant.
        customerCode: unique("CUS"),
        organizationId,
        name,
        isActive,
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

  const makeSale = async ({
    label,
    customerId,
    organizationId,
    saleDate,
    status,
    totalAmount,
    items,
  }: {
    label: string;
    customerId: string;
    organizationId: string;
    saleDate: Date;
    status: string;
    totalAmount: number;
    items: { productId: string; quantity: number; unitPrice: number; totalPrice: number }[];
  }) => {
    const id = `sal_${unique(label)}`;
    await prisma.sale.create({
      data: {
        id,
        saleCode: unique("INV"),
        organizationId,
        customerId,
        totalAmount,
        status,
        saleDate,
        createdAt: saleDate,
      },
    });

    for (const item of items) {
      await prisma.saleItem.create({
        data: { id: `sit_${unique("item")}`, saleId: id, ...item },
      });
    }

    return id;
  };

  const basic = (orgId: string, query = "") =>
    request(app).get(`/api/reports/sales/basic${query}`).set(asOrg(orgId));

  const byCustomer = (orgId: string, query = "") =>
    request(app).get(`/api/reports/sales/by-customer${query}`).set(asOrg(orgId));

  const byProduct = (orgId: string, query = "") =>
    request(app).get(`/api/reports/sales/by-product${query}`).set(asOrg(orgId));

  const full = (orgId: string, query = "") =>
    request(app).get(`/api/reports/sales/full${query}`).set(asOrg(orgId));

  it("totals the window's invoices, customers and units", async () => {
    const res = await basic(t.organizationId, window);

    expect(res.status).toBe(200);
    // 180 + 200 + 50 + 75 + 100.001.
    expect(res.body.totalSales).toBeCloseTo(605.001, 6);
    expect(res.body.totalOrders).toBe(5);
    // Seeded customer, "Zeta Ltd", the other "Zeta Ltd", and the dormant one.
    expect(res.body.uniqueCustomers).toBe(4);
    // 1 + 3, then 1, 1, 2, 1.
    expect(res.body.totalQuantity).toBe(9);
  });

  it("counts invoice lines rather than invoices", async () => {
    // Six lines across five invoices. The groups are keyed on `saleId`, so reading
    // the group count answers five — the same number as `totalOrders`, sitting
    // beside a quantity, under a name that says lines.
    const res = await basic(t.organizationId, window);

    expect(res.body.totalLineItems).toBe(6);
    expect(res.body.totalLineItems).not.toBe(res.body.totalOrders);
  });

  it("reports what the lines add up to beside what the headers say", async () => {
    // 605.001 of headers against 585 of lines, because one invoice is headed at 50
    // and worth 30. Reporting only the first number is what let a wrong header read
    // as a real sale.
    const res = await basic(t.organizationId, window);

    expect(res.body.totalLineSubtotal).toBe(585);
    expect(res.body.totalLineSubtotal).toBeLessThan(res.body.totalSales);
  });

  it("counts the invoices whose header disagrees with their own lines", async () => {
    const res = await basic(t.organizationId, window);

    // One: the 50-against-30 invoice. The 100.001 one is off by a thousandth and
    // is not counted, so the threshold is pinned from both sides — a `> 0` check
    // would report two and claim floating point noise was an accounting error.
    expect(res.body.unreconciledOrders).toBe(1);
  });

  it("does not count a header that is off by less than a cent", async () => {
    const res = await basic(t.organizationId, window);

    expect(res.body.unreconciledOrders).toBe(1);
    expect(res.body.totalLineSubtotal).not.toBeCloseTo(res.body.totalSales - 20, 6);
  });

  it("buckets revenue by the day the invoice was made on", async () => {
    const res = await basic(t.organizationId, window);

    const totals = res.body.dailyTotals.map(
      (d: { date: string; total: number }) => [d.date, d.total]
    );

    expect(totals.map(([date]) => date)).toEqual([
      "2026-02-14",
      "2026-03-03",
      "2026-04-04",
      "2026-05-05",
    ]);
    // Two invoices on 14 February, added together.
    expect(totals[0][1]).toBeCloseTo(380, 6);
  });

  it("breaks the total down by status instead of mixing them", async () => {
    const res = await basic(t.organizationId, window);

    const byStatus = Object.fromEntries(
      res.body.byStatus.map((s: { status: string; totalAmount: number }) => [
        s.status,
        s.totalAmount,
      ])
    );

    expect(Object.keys(byStatus)).toEqual(["Completed", "Pending"]);
    expect(byStatus.Pending).toBeCloseTo(200, 6);
    expect(byStatus.Completed).toBeCloseTo(405.001, 6);
    expect(byStatus.Completed).toBeLessThan(res.body.totalSales);
  });

  it("excludes invoices outside the window", async () => {
    const res = await basic(t.organizationId, window);

    expect(res.body.dailyTotals.map((d: { date: string }) => d.date)).not.toContain(
      "2001-06-06"
    );
    expect(res.body.totalLineItems).toBe(6);
  });

  it("includes every invoice when no window is given", async () => {
    // The legacy took `startDate` and `endDate` as required and did
    // `new Date(undefined)` when they were absent, then compared it — every row
    // failed, so the report came back empty and looked like a tenant that had
    // never sold anything.
    const res = await basic(t.organizationId);

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(6);
    expect(res.body.totalSales).toBeCloseTo(665.001, 6);
    expect(res.body.dailyTotals.map((d: { date: string }) => d.date)).toContain(
      "2001-06-06"
    );
  });

  it("names an invoice with no status as Unspecified", async () => {
    const res = await basic(t.organizationId);

    const unspecified = res.body.byStatus.find(
      (s: { status: string }) => s.status === "Unspecified"
    );

    expect(unspecified).toBeDefined();
    expect(unspecified.orders).toBe(1);
    expect(unspecified.totalAmount).toBeCloseTo(60, 6);
  });

  it("rejects a window that ends before it starts", async () => {
    const res = await basic(
      t.organizationId,
      "?startDate=2026-12-31T00:00:00.000Z&endDate=2026-01-01T00:00:00.000Z"
    );

    expect(res.status).toBe(400);
  });

  it("rejects a date that is not a date", async () => {
    const res = await basic(t.organizationId, "?endDate=last-tuesday");

    expect(res.status).toBe(400);
  });

  it("adds up revenue per customer without merging names", async () => {
    const res = await byCustomer(t.organizationId, window);

    expect(res.status).toBe(200);
    // Biggest first: 300, 100.001, 75, 50.
    expect(res.body.map((r: { customerId: string }) => r.customerId)).toEqual([
      customers.seeded,
      customers.dormant,
      customers.zetaTwin,
      customers.zeta,
    ]);

    const seeded = res.body[0];
    expect(seeded.orders).toBe(2);
    expect(seeded.totalAmount).toBeCloseTo(380, 6);
  });

  it("keeps two customers sharing a name apart", async () => {
    // The legacy accumulated into an object keyed on `customer.name`, so these two
    // arrived as one row with 125 added together. They are two customers.
    const res = await byCustomer(t.organizationId, window);

    const zetas = res.body.filter((r: { name: string }) => r.name === "Zeta Ltd");
    expect(zetas).toHaveLength(2);
    expect(new Set(zetas.map((r: { customerId: string }) => r.customerId)).size).toBe(2);
  });

  it("carries the customer's status without filtering on it", async () => {
    // "Who did we sell to" is not "who may we sell to": a dormant customer with
    // revenue in the window belongs in the report, flagged.
    const res = await byCustomer(t.organizationId, window);

    const dormant = res.body.find(
      (r: { customerId: string }) => r.customerId === customers.dormant
    );

    expect(dormant).toMatchObject({ isActive: false, orders: 1 });
    expect(dormant.totalAmount).toBeCloseTo(DRIFTING_HEADER, 6);
  });

  it("adds up quantity and revenue per product without merging names", async () => {
    const res = await byProduct(t.organizationId, window);

    expect(res.status).toBe(200);
    // Most revenue first: 280, 230, 75.
    expect(res.body.map((r: { productId: string }) => r.productId)).toEqual([
      products.seeded,
      products.gadget,
      products.gadgetTwin,
    ]);

    const seeded = res.body[0];
    expect(seeded.quantity).toBe(5);
    expect(seeded.totalPrice).toBe(280);
    expect(seeded.unit).toBe("pcs");
  });

  it("keeps two products sharing a name apart", async () => {
    const res = await byProduct(t.organizationId, window);

    const gadgets = res.body.filter((r: { name: string }) => r.name === "gadget");
    expect(gadgets).toHaveLength(2);
    expect(new Set(gadgets.map((r: { productId: string }) => r.productId)).size).toBe(2);
  });

  it("averages unit price across lines, not weighted by quantity", async () => {
    // The seeded product was sold at 60, 40 and 100 across three lines, so the mean
    // is 200/3. Weighting by revenue would give 280/5 = 56, and the two want
    // different decisions, so which one is reported has to be pinned.
    const res = await byProduct(t.organizationId, window);

    const seeded = res.body[0];
    expect(seeded.averageUnitPrice).toBeCloseTo(200 / 3, 6);
    expect(seeded.averageUnitPrice).not.toBeCloseTo(280 / 5, 3);
  });

  it("scopes every report to the caller's tenant", async () => {
    // The other tenant took 9999 on one invoice, more than this tenant's window.
    const [basicRes, customerRes, productRes] = await Promise.all([
      basic(t.organizationId, window),
      byCustomer(t.organizationId, window),
      byProduct(t.organizationId, window),
    ]);

    expect(basicRes.body.totalSales).toBeCloseTo(605.001, 6);
    expect(
      customerRes.body.map((r: { customerId: string }) => r.customerId)
    ).not.toContain(t.otherCustomerId);
    expect(
      productRes.body.map((r: { productId: string }) => r.productId)
    ).not.toContain(t.otherProductId);
  });

  it("shows the other tenant its own invoices and nothing else", async () => {
    const [basicRes, productRes] = await Promise.all([
      basic(t.otherOrganizationId, window),
      byProduct(t.otherOrganizationId, window),
    ]);

    expect(basicRes.body.totalOrders).toBe(1);
    expect(basicRes.body.totalSales).toBe(9999);
    expect(productRes.body.map((r: { productId: string }) => r.productId)).toEqual([
      t.otherProductId,
    ]);
  });

  it("returns all three reports together, each matching its own endpoint", async () => {
    const res = await full(t.organizationId, window);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "basic",
      "byCustomer",
      "byProduct",
      "generatedAt",
    ]);

    const [basicRes, customerRes, productRes] = await Promise.all([
      basic(t.organizationId, window),
      byCustomer(t.organizationId, window),
      byProduct(t.organizationId, window),
    ]);

    expect(res.body.basic).toEqual(basicRes.body);
    expect(res.body.byCustomer).toEqual(customerRes.body);
    expect(res.body.byProduct).toEqual(productRes.body);
  });

  it("needs a tenant, and says so", async () => {
    const res = await request(app).get("/api/reports/sales/basic");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });
});
