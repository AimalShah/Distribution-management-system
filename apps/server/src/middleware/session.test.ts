import request from "supertest";
import express, { type Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "../auth";
import { errorHandler } from "../http";
import { ORGANIZATION_HEADER, USER_HEADER } from "./auth-context";
import { sessionAuthContext, sessionBootstrapAuthContext } from "./session";

const { memberModel, dbStub } = vi.hoisted(() => {
  const member = { findUnique: vi.fn() };

  return { memberModel: member, dbStub: { member } };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const getSession = vi.fn();

const auth = { api: { getSession } } as unknown as Auth;

const session = (activeOrganizationId: string | null = "org_1") => ({
  session: { id: "ses_1", activeOrganizationId },
  user: { id: "usr_1" },
});

const buildApp = (): Express => {
  const app = express();
  app.get("/strict", sessionAuthContext(auth), (req, res) => res.json(req.auth));
  app.get("/bootstrap", sessionBootstrapAuthContext(auth), (req, res) => res.json(req.auth));
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
