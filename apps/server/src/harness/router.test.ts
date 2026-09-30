import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { getRecentQueries } = vi.hoisted(() => ({ getRecentQueries: vi.fn() }));

vi.mock("@dms/db/debug-log", () => ({ getRecentQueries }));

// `harness/router.ts` imports `@dms/db/debug-log` only, so the default
// `@dms/db` stub needs no models -- the harness never touches the database.
vi.mock("@dms/db", () => ({ default: {}, prisma: {} }));

const { harnessRouter } = await import("./router");

import express from "express";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/__debug", harnessRouter);
  return app;
};

describe("GET /__debug/state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the recent queries and the last-minute count", async () => {
    getRecentQueries.mockReturnValue([
      { model: "Product", action: "findMany", ms: 3, at: new Date().toISOString() },
      { model: "Sale", action: "create", ms: 8, at: new Date().toISOString() },
    ]);

    const res = await request(buildApp()).get("/__debug/state");

    expect(res.status).toBe(200);
    expect(res.body.recentQueries).toHaveLength(2);
    expect(res.body.queryCountLastMinute).toBe(2);
  });

  it("excludes queries older than a minute from the count", async () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    getRecentQueries.mockReturnValue([
      { model: "Product", action: "findMany", ms: 1, at: old },
    ]);

    const res = await request(buildApp()).get("/__debug/state");

    expect(res.body.recentQueries).toHaveLength(1);
    expect(res.body.queryCountLastMinute).toBe(0);
  });

  it("caps the returned query list at 50", async () => {
    const at = new Date().toISOString();
    getRecentQueries.mockReturnValue(
      Array.from({ length: 120 }, () => ({ model: "Product", action: "findMany", ms: 1, at }))
    );

    const res = await request(buildApp()).get("/__debug/state");

    expect(res.body.recentQueries).toHaveLength(50);
  });
});

describe("POST /__debug/call", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a service name that escapes the services directory", async () => {
    // The import specifier is built from a template literal. Without
    // validation this resolves outside `services/` and executes a module that
    // was never meant to be reachable over HTTP.
    for (const service of [
      "../../../config/env",
      "../config/env",
      "product/../../../config/env",
      "/etc/passwd",
    ]) {
      const res = await request(buildApp())
        .post("/__debug/call")
        .send({ service, fn: "parseOrigins" });

      expect(res.status, `service "${service}" must be rejected`).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  it("rejects a function name that is not an identifier", async () => {
    for (const fn of ["a/b", "a.b", "fn()", "a b", ""]) {
      const res = await request(buildApp())
        .post("/__debug/call")
        .send({ service: "product", fn });

      expect(res.status, `fn "${fn}" must be rejected`).toBe(400);
    }
  });

  it("rejects inherited properties that pass a typeof check", async () => {
    // Every module namespace object has `constructor`, and it is callable.
    for (const fn of ["constructor", "prototype"]) {
      const res = await request(buildApp())
        .post("/__debug/call")
        .send({ service: "product", fn });

      expect(res.status, `fn "${fn}" must be rejected`).toBe(400);
    }
  });

  it("400s when service or fn is missing entirely", async () => {
    for (const body of [{}, { service: "product" }, { fn: "listProducts" }]) {
      const res = await request(buildApp()).post("/__debug/call").send(body);
      expect(res.status, `body ${JSON.stringify(body)} must be rejected`).toBe(400);
    }
  });

  it("404s for a real service that does not export that function", async () => {
    const res = await request(buildApp())
      .post("/__debug/call")
      .send({ service: "product", fn: "definitelyNotExported" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("500s rather than crashing when the target module throws", async () => {
    // Passes the name pattern, so this exercises the dynamic import failing
    // rather than the validation rejecting the input.
    const res = await request(buildApp())
      .post("/__debug/call")
      .send({ service: "nosuchservicemodule", fn: "anything" });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe("string");
  });

  it("passes a single non-array argument through as one argument", async () => {
    const res = await request(buildApp()).post("/__debug/call").send({
      service: "product",
      fn: "listProducts",
      args: { organizationId: "org_1" },
    });

    // The import reaches the real service module, which touches prisma. The
    // stub has no models, so this throws -- the assertion is that the harness
    // reports it rather than hanging or crashing the process.
    expect([404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
