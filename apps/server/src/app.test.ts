import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";

vi.mock("@dms/db", () => ({
  default: {},
  prisma: {},
}));

const app = createApp();

const allowed = "http://localhost:5173";
const hostile = "https://attacker.example";

describe("CORS", () => {
  it("answers a request from the dev origin", async () => {
    const res = await request(app).get("/api/health").set("Origin", allowed);

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
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
