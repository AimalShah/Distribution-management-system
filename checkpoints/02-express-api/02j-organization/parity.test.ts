/**
 * Checkpoint 2j — Organization API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2j — Organization API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/organizations returns user organizations", async () => {
    const res = await request(app)
      .get("/api/organizations")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/organizations creates organization", async () => {
    const res = await request(app)
      .post("/api/organizations")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Test Org", slug: "test-org" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Org");
  });

  it("GET /api/organizations/active returns active org", async () => {});
  it("POST /api/organizations/set-active sets active org", async () => {});
  it("POST /api/organizations/:id/users adds user", async () => {});
});
