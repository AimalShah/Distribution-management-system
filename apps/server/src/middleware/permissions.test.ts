import request from "supertest";
import express, { type Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../http";
import { authContext, ORGANIZATION_HEADER, USER_ENV_VAR, USER_HEADER } from "./auth-context";
import { requireAdmin } from "./permissions";

const { memberModel, dbStub } = vi.hoisted(() => {
  const member = { findFirst: vi.fn() };

  return { memberModel: member, dbStub: { $transaction: vi.fn(), member } };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const ORG = "org_1";

const OTHER_ORG = "org_2";

const OWNER = "user_owner";

/**
 * `requireAdmin` is not mounted on any production route yet, so it is exercised
 * against a route built for the purpose. That is the point of the arrangement:
 * "the middleware works" is a claim with a test behind it, instead of an export
 * nothing has ever called. If a later checkpoint wires it onto a real route, the
 * real route's tests are the ones that should matter, and this stays as the unit
 * test of the guard itself.
 */
const buildApp = (): Express => {
  const app = express();
  app.get("/admin-only", authContext, requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);

  return app;
};

const app = buildApp();

const asUser = (userId: string, organizationId = ORG) =>
  request(app)
    .get("/admin-only")
    .set(USER_HEADER, userId)
    .set(ORGANIZATION_HEADER, organizationId);

beforeEach(() => {
  vi.clearAllMocks();
  memberModel.findFirst.mockResolvedValue({ role: "owner" });
});

describe("requireAdmin", () => {
  it("allows an owner through", async () => {
    const res = await asUser(OWNER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects a member", async () => {
    memberModel.findFirst.mockResolvedValue({ role: "member" });

    const res = await asUser(OWNER);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  it("rejects an adminRole, preserving the legacy's owner-only meaning", async () => {
    // `isAdmin()` asked better-auth for project:["update","delete"] and only
    // `owner` carries `delete`. adminRole is elevated for member management in
    // 2k and is still not an admin here.
    memberModel.findFirst.mockResolvedValue({ role: "adminRole" });

    const res = await asUser(OWNER);

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/admin-only");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(memberModel.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a request with a user but no organization", async () => {
    const res = await request(app).get("/admin-only").set(USER_HEADER, OWNER);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("rejects a caller who is not a member of the organization", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await asUser(OWNER);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  it("checks the membership of the organization in the header", async () => {
    await asUser(OWNER, OTHER_ORG);

    expect(memberModel.findFirst).toHaveBeenCalledWith({
      where: { userId: OWNER, organizationId: OTHER_ORG },
      select: { role: true },
    });
  });

  it("reaches the error handler rather than hanging", async () => {
    // Express 4 does not catch a rejected promise from an async handler. If this
    // middleware were `async (req, res, next) => { throw ... }` the request would
    // never be answered and this test would time out instead of failing.
    memberModel.findFirst.mockRejectedValue(new Error("database is down"));

    const res = await asUser(OWNER);

    expect(res.status).toBe(500);
  });

  it("never treats a missing context as permission to proceed", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    // A guard that answers "allowed" when it cannot tell is a guard that can be
    // switched off by omitting a header.
    const noUser = await request(app)
      .get("/admin-only")
      .set(ORGANIZATION_HEADER, ORG);

    const noOrg = await request(app)
      .get("/admin-only")
      .set(USER_HEADER, OWNER);

    expect(noUser.status).toBe(400);
    expect(noOrg.status).toBe(400);
    expect(memberModel.findFirst).not.toHaveBeenCalled();
  });

  it("selects only the role", async () => {
    await asUser(OWNER);

    expect(memberModel.findFirst.mock.calls[0][0].select).toEqual({ role: true });
  });
});
