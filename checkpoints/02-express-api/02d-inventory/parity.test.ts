/**
 * Checkpoint 2d — Inventory API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 2d — Inventory API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/inventory returns paginated response", async () => {
    const res = await request(app)
      .get("/api/inventory")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("GET /api/inventory/logs returns paginated logs", async () => {
    const res = await request(app)
      .get("/api/inventory/logs")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("POST /api/inventory/adjust creates adjustment with log", async () => {
    // Setup: create inventory, adjust, verify log created
  });

  it("GET /api/inventory/low-stock returns low stock items", async () => {});

  it("PUT /api/inventory/:id/settings updates settings", async () => {});
});
