/**
 * Checkpoint 2f — Customer API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 2f — Customer API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/customers returns paginated response", async () => {
    const res = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pageCount");
    expect(res.body).toHaveProperty("total");
  });

  it("POST /api/customers creates a customer", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        customerCode: "CUST-001",
        name: "Test Customer",
        email: "test@example.com",
        phone: "1234567890",
        creditLimit: "10000",
        isActive: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Customer");
    expect(res.body.creditLimit).toBe(10000);
  });

  it("GET /api/customers/:id returns single customer", async () => {});
  it("PUT /api/customers/:id updates customer", async () => {});
  it("DELETE /api/customers/:id deletes customer", async () => {});
  it("rejects invalid customer data", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });
});
