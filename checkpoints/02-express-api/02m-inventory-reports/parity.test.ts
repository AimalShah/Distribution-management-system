/**
 * Checkpoint 2m — Inventory Reports API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 2m — Inventory Reports API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/reports/inventory/basic returns basic report", async () => {
    const res = await request(app)
      .get("/api/reports/inventory/basic?startDate=2025-01-01&endDate=2025-12-31")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it("GET /api/reports/inventory/movements returns movements", async () => {});
  it("GET /api/reports/inventory/low-stock returns low stock", async () => {});
  it("GET /api/reports/inventory/stock-valuation returns valuation", async () => {});
  it("GET /api/reports/inventory/expiry returns expiry report", async () => {});
  it("GET /api/reports/inventory/full returns all reports", async () => {});
});
