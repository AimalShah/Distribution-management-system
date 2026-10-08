import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER, USER_HEADER } from "../middleware/auth-context";

const { models } = vi.hoisted(() => {
  const reorderLevel = Object.freeze({
    modelName: "Inventory",
    name: "reorderLevel",
  });

  const models = {
    member: { findFirst: async () => ({ role: "owner" }) },
    product: { count: vi.fn() },
    customer: { count: vi.fn() },
    supplier: { count: vi.fn() },
    sale: { aggregate: vi.fn(), findMany: vi.fn() },
    purchase: { aggregate: vi.fn(), findMany: vi.fn() },
    inventory: {
      count: vi.fn(),
      findMany: vi.fn(),
      // Stands in for the field reference the service compares `quantityOnHand`
      // against, so the test can assert the column to column comparison is what
      // actually reaches Prisma.
      fields: { reorderLevel },
    },
    reorderLevel,
    stockBatch: { count: vi.fn(), findMany: vi.fn() },
  };

  return { models };
});

vi.mock("@dms/db", () => ({
  default: models,
  prisma: models,
}));

const app = createApp();

const ORG = "org_1";

const auth = () => ({
  [ORGANIZATION_HEADER]: ORG,
  [USER_HEADER]: "usr_1",
});

const sum = (totalAmount: number) => ({ _sum: { totalAmount } });

beforeEach(() => {
  vi.clearAllMocks();
  models.product.count.mockResolvedValue(12);
  models.customer.count.mockResolvedValue(7);
  models.supplier.count.mockResolvedValue(4);
  models.sale.aggregate.mockResolvedValue(sum(48_000));
  models.purchase.aggregate.mockResolvedValue(sum(19_500));
  models.sale.findMany.mockResolvedValue([]);
  models.purchase.findMany.mockResolvedValue([]);
  models.inventory.count.mockResolvedValue(3);
  models.inventory.findMany.mockResolvedValue([]);
  models.stockBatch.count.mockResolvedValue(0);
  models.stockBatch.findMany.mockResolvedValue([]);
});

describe("GET /api/dashboard/stats", () => {
  it("rejects a request without an organization and never touches the database", async () => {
    const res = await request(app).get("/api/dashboard/stats");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(models.product.count).not.toHaveBeenCalled();
  });

  it("returns the counters the dashboard reads", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(auth());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalProducts: 12,
      totalCustomers: 7,
      totalSuppliers: 4,
      totalSalesAmount: 48_000,
      totalPurchasesAmount: 19_500,
      lowStockCount: 3,
      recentSales: [],
      recentPurchases: [],
      topInventory: [],
    });
  });

  it("scopes every query to the caller's organization", async () => {
    await request(app).get("/api/dashboard/stats").set(auth());

    expect(models.product.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
    expect(models.customer.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
    expect(models.supplier.count).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
    expect(models.sale.aggregate).toHaveBeenCalledWith({
      where: { organizationId: ORG, deletedAt: null },
      _sum: { totalAmount: true },
    });
    expect(models.purchase.aggregate).toHaveBeenCalledWith({
      where: { organizationId: ORG },
      _sum: { totalAmount: true },
    });
    expect(models.inventory.count).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        quantityOnHand: { lte: models.reorderLevel },
      },
    });
    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
      })
    );
  });

  it("reports an empty organization's money totals as zero, not null", async () => {
    models.sale.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
    models.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });

    const res = await request(app).get("/api/dashboard/stats").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.totalSalesAmount).toBe(0);
    expect(res.body.totalPurchasesAmount).toBe(0);
  });

  it("counts low stock by comparing the column to reorderLevel", async () => {
    await request(app).get("/api/dashboard/stats").set(auth());

    expect(models.inventory.count).toHaveBeenCalledWith({
      where: {
        organizationId: ORG,
        quantityOnHand: { lte: models.reorderLevel },
      },
    });
  });

  it("takes only the five most recent sales and purchases", async () => {
    await request(app).get("/api/dashboard/stats").set(auth());

    expect(models.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG, deletedAt: null },
        orderBy: { saleDate: "desc" },
        take: 5,
      })
    );
    expect(models.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { purchaseDate: "desc" },
        take: 5,
      })
    );
  });

  it("orders the chart's inventory by stock, not by recency", async () => {
    await request(app).get("/api/dashboard/stats").set(auth());

    expect(models.inventory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { quantityOnHand: "desc" },
        take: 10,
      })
    );
  });

  it("returns the recent lists the feed renders", async () => {
    models.sale.findMany.mockResolvedValue([
      {
        id: "sale_1",
        saleCode: "INV-0001",
        totalAmount: 1500,
        status: "completed",
        saleDate: "2026-01-02T00:00:00.000Z",
        customer: { name: "Acme Retail" },
      },
    ]);
    models.purchase.findMany.mockResolvedValue([
      {
        id: "pur_1",
        purchaseCode: "PUR-0001",
        totalAmount: 400,
        status: "received",
        purchaseDate: "2026-01-01T00:00:00.000Z",
        supplier: { companyName: "Northwind Supply", contactPerson: "Ana" },
      },
    ]);

    const res = await request(app).get("/api/dashboard/stats").set(auth());

    expect(res.status).toBe(200);
    expect(res.body.recentSales[0]).toMatchObject({
      saleCode: "INV-0001",
      totalAmount: 1500,
      customer: { name: "Acme Retail" },
    });
    expect(res.body.recentPurchases[0]).toMatchObject({
      purchaseCode: "PUR-0001",
      supplier: { companyName: "Northwind Supply" },
    });
  });
});
