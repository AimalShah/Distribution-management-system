import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@dms/db", () => ({
  default: { $queryRaw: queryRaw },
  prisma: { $queryRaw: queryRaw },
}));

const app = createApp();

const allowed = "http://localhost:5173";

const hostile = "https://attacker.example";

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([{ result: 1 }]);
});

describe("CORS", () => {
  it("answers a request from the dev origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", allowed)
      .set("X-Request-Id", "health-check-1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "ok" });
    expect(res.body.uptimeSeconds).toBeTypeOf("number");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.checks.database.status).toBe("ok");
    expect(res.body.checks.memory.heapUsedMb).toBeTypeOf("number");
    expect(res.headers["x-request-id"]).toBe("health-check-1");
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
  });

  it("reports the database as down without exposing the database error", async () => {
    queryRaw.mockRejectedValue(new Error("database secret detail"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "error", db: "down" });
    expect(res.body.checks.database.status).toBe("down");
    expect(res.text).not.toContain("database secret detail");
  });

  it("withholds the header from an origin that is not on the allowlist", async () => {
    const res = await request(app).get("/api/health").set("Origin", hostile);

    // The request still runs, because CORS is enforced by the browser reading
    // the response, not by the server refusing it. What matters is that no
    // `Access-Control-Allow-Origin` comes back, so the browser withholds the
    // body from the hostile page.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not answer a preflight from an origin that is not on the allowlist", async () => {
    const res = await request(app)
      .options("/api/sales")
      .set("Origin", hostile)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "x-organization-id");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("passes a request with no Origin straight through", async () => {
    // curl, another server and the rest of the test suite are not browsers, so
    // CORS does not apply to them and requiring an allowlisted Origin would
    // break them for no security gain.
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
  });
});
