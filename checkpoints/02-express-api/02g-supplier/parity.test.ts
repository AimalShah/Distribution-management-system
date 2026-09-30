/**
 * Checkpoint 2g — Supplier API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2g — Supplier API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/suppliers returns paginated response", async () => {
    const res = await request(app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
  });

  it("POST /api/suppliers creates a supplier", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        supplierCode: "SUP-001",
        companyName: "Test Supplier",
        contactPerson: "John Doe",
        phone: "1234567890",
        address: "123 Main St",
        city: "Mumbai",
        isActive: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.companyName).toBe("Test Supplier");
  });

  it("GET /api/suppliers/:id returns single supplier", async () => {});
  it("PUT /api/suppliers/:id updates supplier", async () => {});
  it("DELETE /api/suppliers/:id deletes supplier", async () => {});
});
