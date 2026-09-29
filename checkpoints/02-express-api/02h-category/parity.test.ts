/**
 * Checkpoint 2h — Category API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 2h — Category API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/categories returns paginated response", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("POST /api/categories creates a category", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Test Category", description: "Test" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Category");
  });

  it("POST /api/categories rejects duplicate name in same org", async () => {
    // Create category, then try to create another with same name
  });

  it("GET /api/categories/:id returns single category", async () => {});
  it("PUT /api/categories/:id updates category", async () => {});
  it("DELETE /api/categories/:id deletes category", async () => {});
});
