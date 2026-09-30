/**
 * Checkpoint 2c — Sale Invoice API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2c — Sale Invoice API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/sales returns paginated response", async () => {
    const res = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("POST /api/sales creates sale with inventory deduction", async () => {
    // Setup: create customer, product, inventory
    // Create sale, verify inventory decreased
  });

  it("GET /api/sales/:id works with saleCode", async () => {
    // Create sale, fetch by saleCode
  });

  it("GET /api/sales/customer/:customerId returns customer sales", async () => {});

  it("PUT /api/sales/:id updates sale", async () => {});

  it("DELETE /api/sales/:id deletes sale", async () => {});
});
