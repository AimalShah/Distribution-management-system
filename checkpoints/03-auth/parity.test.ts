/**
 * Checkpoint 3 — Auth: Parity Test
 * 
 * Tests Express auth endpoints match original better-auth behavior.
 * Run with: pnpm --filter server run test:checkpoint3
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Checkpoint 3 — Auth", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp();
  });

  it("POST /api/auth/sign-up/email creates user", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up/email")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });
    expect(res.status).toBe(200);
  });

  it("POST /api/auth/sign-in/email logs in", async () => {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({
        email: "test@example.com",
        password: "password123",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("GET /api/auth/session returns session", async () => {
    // Login first, then get session
  });

  it("POST /api/auth/sign-out logs out", async () => {});

  it("unauthenticated requests return 401", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("organization creation works", async () => {
    // Login, create org
  });

  it("organization switching works", async () => {
    // Create two orgs, switch between them
  });

  it("admin can manage users", async () => {
    // Admin login, create/delete users
  });
});
