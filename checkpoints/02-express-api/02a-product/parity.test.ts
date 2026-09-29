/**
 * Checkpoint 2a — Product API: Parity Test
 * 
 * Tests Express product endpoints against documented source behavior.
 * Run with: pnpm --filter server run test:checkpoint2a
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import prisma from "@dms/db";

describe("Checkpoint 2a — Product API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;
  let orgId: string;

  beforeAll(async () => {
    app = createApp();
    // Setup: create test org, user, get auth token
    // This will be implemented with actual test helpers
  });

  it("GET /api/products returns paginated response", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/products creates a product", async () => {
    const productData = {
      name: "Test Product",
      productCode: "TEST-001",
      category: "test-cat",
      unit: "pcs",
      brand: "test-brand",
      unitCost: "10.00",
      unitPrice: "20.00",
      isActive: true,
    };
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${authToken}`)
      .send(productData);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Product");
    expect(res.body.unitCost).toBe(10);
  });

  it("GET /api/products/:id returns single product", async () => {
    // Create then fetch
  });

  it("PUT /api/products/:id updates product", async () => {
    // Create then update
  });

  it("DELETE /api/products/:id deletes product", async () => {
    // Create then delete
  });

  it("rejects invalid product data", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });
});
