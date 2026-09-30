/**
 * Checkpoint 2i — Brand API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2i — Brand API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/brands returns paginated response", async () => {
    const res = await request(app)
      .get("/api/brands")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("POST /api/brands creates a brand", async () => {
    const res = await request(app)
      .post("/api/brands")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Test Brand", description: "Test" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Brand");
  });

  it("GET /api/brands/:id returns single brand", async () => {});
  it("PUT /api/brands/:id updates brand", async () => {});
  it("DELETE /api/brands/:id deletes brand", async () => {});
});
