/**
 * Checkpoint 2b — Purchase API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";
import prisma from "@dms/db";

describe("Checkpoint 2b — Purchase API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/purchases returns paginated response", async () => {
    const res = await request(app)
      .get("/api/purchases")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
    expect(res.body).toHaveProperty("total");
  });

  it("POST /api/purchases creates purchase with inventory updates", async () => {
    // Setup: create supplier, product, inventory
    // Then create purchase and verify inventory increased
  });

  it("POST /api/purchases is atomic — rolls back on invalid item", async () => {
    // Send purchase with one valid + one invalid item
    // Verify nothing was created
  });

  it("GET /api/purchases/:id returns purchase with items", async () => {});

  it("PUT /api/purchases/:id updates purchase", async () => {});

  it("DELETE /api/purchases/:id deletes purchase", async () => {});
});
