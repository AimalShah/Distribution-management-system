import request from "supertest";
import express, { type Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "../auth";
import { errorHandler } from "../http";
import { ORGANIZATION_HEADER, USER_HEADER } from "./auth-context";
import {
  sessionAuthContext,
  sessionBootstrapAuthContext,
  sessionBootstrapOpenAuthContext,
} from "./session";

const { memberModel, dbStub } = vi.hoisted(() => {
  const member = { findUnique: vi.fn() };

  return { memberModel: member, dbStub: { member } };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const getSession = vi.fn();

const auth = { api: { getSession } } as unknown as Auth;

interface SessionUser {
  id: string;
  banned?: boolean | null;
  mustChangePassword?: boolean | null;
}

const session = (
  activeOrganizationId: string | null = "org_1",
  user: Partial<SessionUser> = {}
) => ({
  session: { id: "ses_1", activeOrganizationId },
  user: { id: "usr_1", ...user },
});

const buildApp = (): Express => {
  const app = express();
  app.get("/strict", sessionAuthContext(auth), (req, res) => res.json(req.auth));
  app.get("/bootstrap", sessionBootstrapAuthContext(auth), (req, res) => res.json(req.auth));
  app.get("/open", sessionBootstrapOpenAuthContext(auth), (req, res) => res.json(req.auth));
  app.use(errorHandler);

  return app;
};

const app = buildApp();

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(session());
  memberModel.findUnique.mockResolvedValue({ id: "mem_1" });
});

describe("sessionAuthContext", () => {
  it("fills req.auth from the session, not from headers", async () => {
    const res = await request(app)
      .get("/strict")
      .set(ORGANIZATION_HEADER, "org_attacker")
      .set(USER_HEADER, "usr_attacker");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organizationId: "org_1", userId: "usr_1", sessionId: "ses_1" });
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await request(app).get("/strict").set(ORGANIZATION_HEADER, "org_1");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
    expect(memberModel.findUnique).not.toHaveBeenCalled();
  });

  it("passes Bearer token from query parameter if Authorization header is omitted", async () => {
    const res = await request(app).get("/strict?token=sample_query_token");

    expect(res.status).toBe(200);
    expect(getSession).toHaveBeenCalled();
    // SAFETY: fromNodeHeaders returns a standard Web Headers instance.
    const passedHeaders = getSession.mock.calls[0][0].headers as Headers;
    expect(passedHeaders.get("authorization")).toBe("Bearer sample_query_token");
  });

  it("answers 400 when the session has no active organization", async () => {
    getSession.mockResolvedValue(session(null));

    const res = await request(app).get("/strict");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });

  it("answers 403 when the user is no longer a member of the active organization", async () => {
    memberModel.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/strict");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
    expect(memberModel.findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: "org_1", userId: "usr_1" } },
      select: { id: true },
    });
  });

  it("passes a session lookup failure to the error handler instead of hanging", async () => {
    getSession.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/strict");

    expect(res.status).toBe(500);
  });
});

describe("P0-5 account locks", () => {
  it("refuses a provisioned staff member at a tenant route until the password is changed", async () => {
    // The flag is what makes the temporary password temporary: with it, no
    // tenant route answers at all.
    getSession.mockResolvedValue(session("org_1", { mustChangePassword: true }));

    const res = await request(app).get("/strict");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    expect(memberModel.findUnique).not.toHaveBeenCalled();
  });

  it("refuses the same member at the organization routes too", async () => {
    // Or they could create an organization before ever setting a password of
    // their own.
    getSession.mockResolvedValue(session(null, { mustChangePassword: true }));

    const res = await request(app).get("/bootstrap");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
  });

  it("answers the first-login password change through the open mount", async () => {
    // The route that ends the flag is the one route the flag must not gate.
    getSession.mockResolvedValue(session(null, { mustChangePassword: true }));

    const res = await request(app).get("/open");

    expect(res.status).toBe(200);
  });

  it("refuses a deactivated member with 401", async () => {
    // Deactivation deletes their sessions; a session recorded moments before
    // the write lands is the race this answers.
    getSession.mockResolvedValue(session("org_1", { banned: true }));

    const res = await request(app).get("/strict");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
  });

  it("refuses a deactivated member at the bootstrap routes too", async () => {
    getSession.mockResolvedValue(session(null, { banned: true }));

    const res = await request(app).get("/bootstrap");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
  });

  it("deactivation wins over the forced-password-change state", async () => {
    getSession.mockResolvedValue(
      session(null, { banned: true, mustChangePassword: true })
    );

    const res = await request(app).get("/bootstrap");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "ACCOUNT_DEACTIVATED" });
  });

  it("answers both locks as absent for a normal member", async () => {
    getSession.mockResolvedValue(
      session("org_1", { banned: null, mustChangePassword: null })
    );

    const res = await request(app).get("/strict");

    expect(res.status).toBe(200);
  });
});

describe("sessionBootstrapAuthContext", () => {
  it("requires a session but not an organization", async () => {
    getSession.mockResolvedValue(session(null));

    const res = await request(app).get("/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organizationId: "", userId: "usr_1", sessionId: "ses_1" });
    expect(memberModel.findUnique).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await request(app).get("/bootstrap");

    expect(res.status).toBe(401);
  });
});
