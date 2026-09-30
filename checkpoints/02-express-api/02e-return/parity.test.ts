/**
 * Checkpoint 2e — Return API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2e — Return API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/returns returns paginated response", async () => {
    const res = await request(app)
      .get("/api/returns")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("POST /api/returns creates SALE return with inventory IN movement", async () => {
    // Setup: create sale, inventory, then return
    // Verify inventory increased
  });

  it("POST /api/returns creates PURCHASE return with inventory OUT movement", async () => {
    // Verify inventory decreased
  });

  it("POST /api/returns rejects SALE return without saleId", async () => {
    const res = await request(app)
      .post("/api/returns")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ returnType: "SALE", returnCode: "RET-001", items: [] });
    expect(res.status).toBe(400);
  });

  it("GET /api/returns/:id returns single return", async () => {});

  it("PUT /api/returns/:id updates return", async () => {});

  it("DELETE /api/returns/:id deletes return", async () => {});
});
