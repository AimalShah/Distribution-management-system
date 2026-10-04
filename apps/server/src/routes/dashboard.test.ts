import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";
import { trendPercent } from "../services/dashboard";

const { dbStub } = vi.hoisted(() => {
  const aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: null } });
  const empty = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  return {
    dbStub: {
      sale: { aggregate, findMany: empty },
      purchase: { aggregate, findMany: empty },
      customer: { count },
      product: { count, findMany: empty },
      inventory: { count, findMany: empty, fields: { reorderLevel: "reorderLevel" } },
      saleItem: { groupBy: empty },
    },
  };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

describe("trendPercent", () => {
  it("is the percentage change to one decimal place", () => {
    expect(trendPercent(300, 200)).toBe(50);
    expect(trendPercent(100, 300)).toBe(-66.7);
  });

  it("is null when there is nothing to compare against", () => {
    expect(trendPercent(500, 0)).toBeNull();
  });
});

describe("GET /api/dashboard/stats", () => {
  it("scopes every query to the caller's tenant", async () => {
    const res = await request(app).get("/api/dashboard/stats").set(ORGANIZATION_HEADER, "org_1");

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ sales: 0, purchases: 0, customers: 0, products: 0 });
    for (const call of dbStub.sale.aggregate.mock.calls) {
      expect(call[0].where.organizationId).toBe("org_1");
    }
    expect(dbStub.saleItem.groupBy.mock.calls[0][0].where.sale.organizationId).toBe("org_1");
    expect(dbStub.inventory.count.mock.calls[0][0].where.organizationId).toBe("org_1");
  });

  it("requires a tenant", async () => {
    const res = await request(app).get("/api/dashboard/stats");

    expect(res.status).toBe(400);
  });
});
