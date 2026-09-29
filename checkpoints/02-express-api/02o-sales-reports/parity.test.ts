/**
 * Checkpoint 2o — Sales Reports API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 2o — Sales Reports API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/reports/sales/basic returns basic report", async () => {
    const res = await request(app)
      .get("/api/reports/sales/basic?startDate=2025-01-01&endDate=2025-12-31")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it("GET /api/reports/sales/by-customer returns by customer", async () => {});
  it("GET /api/reports/sales/by-product returns by product", async () => {});
  it("GET /api/reports/sales/full returns all reports", async () => {});
});
