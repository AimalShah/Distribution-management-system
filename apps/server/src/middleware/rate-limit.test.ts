import request from "supertest";
import express, { type Express } from "express";
import { describe, expect, it } from "vitest";
import { credentialEntryLimiter, authSurfaceLimiter } from "./rate-limit";

/** Mount a limiter on a bare app, reading client addresses from X-Forwarded-For. */
const limiterApp = (...limiters: express.RequestHandler[]): Express => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(limiters);

  return app;
};

describe("credentialEntryLimiter", () => {
  const app = limiterApp(credentialEntryLimiter);
  app.post("/fail", (_req, res) => res.status(401).json({}));
  app.post("/ok", (_req, res) => res.status(200).json({}));

  it("refuses the 11th failed credential attempt from one address with 429", async () => {
    const attempts = Array.from({ length: 10 }, () =>
      request(app).post("/fail").set("X-Forwarded-For", "200.10.0.1")
    );

    for (const res of await Promise.all(attempts)) expect(res.status).toBe(401);

    const blocked = await request(app).post("/fail").set("X-Forwarded-For", "200.10.0.1");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("does not burn the failure budget on successful sign-ins", async () => {
    const successes = Array.from({ length: 25 }, () =>
      request(app).post("/ok").set("X-Forwarded-For", "200.10.0.2")
    );

    for (const res of await Promise.all(successes)) expect(res.status).toBe(200);

    // A different address still pays for its own failures.
    const failing = await request(app).post("/fail").set("X-Forwarded-For", "200.10.0.3");

    expect(failing.status).toBe(401);
  });
});

describe("authSurfaceLimiter", () => {
  const app = limiterApp(authSurfaceLimiter);
  app.get("/session", (_req, res) => res.json({ ok: true }));

  it("allows up to 300 requests per window from one address, then 429s", async () => {
    const allowed = Array.from({ length: 300 }, () =>
      request(app).get("/session").set("X-Forwarded-For", "201.10.0.9")
    );

    for (const res of await Promise.all(allowed)) expect(res.status).toBe(200);

    const blocked = await request(app).get("/session").set("X-Forwarded-For", "201.10.0.9");

    expect(blocked.status).toBe(429);
  });
});

describe("per-address isolation", () => {
  it("limits stay independent across addresses", async () => {
    const app = limiterApp(credentialEntryLimiter);
    app.post("/fail", (_req, res) => res.status(401).json({}));

    for (let i = 0; i < 4; i++) {
      await request(app).post("/fail").set("X-Forwarded-For", `198.20.${i}.1`);
    }

    // Four callers are 4 failures in; a fresh address is untouched.
    const fresh = await request(app).post("/fail").set("X-Forwarded-For", "198.20.10.1");

    expect(fresh.status).toBe(401);
  });
});
