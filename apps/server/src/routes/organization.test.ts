import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { SESSION_HEADER, USER_ENV_VAR, USER_HEADER } from "../middleware/auth-context";

const { organizationModel, memberModel, sessionModel, userModel, dbStub } =
  vi.hoisted(() => {
    const organization = {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    };

    const member = {
      findFirst: vi.fn(),
    };

    const session = {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    };

    const user = {
      update: vi.fn(),
    };

    // A callback-passing $transaction stub, so the test controls what the
    // transaction body sees rather than asserting on a mock call.
    const $transaction = vi.fn(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ organization, member, session, user })
    );

    return {
      organizationModel: organization,
      memberModel: member,
      sessionModel: session,
      userModel: user,
      dbStub: {
        $transaction,
        organization,
        member,
        session,
        user,
      },
    };
  });

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

const USER = "user_1";

const SESSION = "session_1";

const ORG = "org_1";

const organizationFixture = (overrides: Record<string, unknown> = {}) => ({
  id: ORG,
  name: "Acme Distribution",
  slug: "acme-distribution",
  logo: null,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const validBody = { name: "Acme Distribution", slug: "acme-distribution" };

beforeEach(() => {
  vi.clearAllMocks();
  organizationModel.findMany.mockResolvedValue([organizationFixture()]);
  organizationModel.findFirst.mockResolvedValue(organizationFixture());
  organizationModel.create.mockResolvedValue(organizationFixture());
  memberModel.findFirst.mockResolvedValue({
    id: "mem_1",
    userId: USER,
    organizationId: ORG,
    role: "owner",
  });
  sessionModel.findFirst.mockResolvedValue({ activeOrganizationId: ORG });
  sessionModel.updateMany.mockResolvedValue({ count: 1 });
  userModel.update.mockResolvedValue({ id: USER });
});

describe("GET /api/organizations", () => {
  it("lists the organizations the caller is a member of", async () => {
    const res = await request(app)
      .get("/api/organizations")
      .set(USER_HEADER, USER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(organizationModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { members: { some: { userId: USER } } },
      })
    );
  });

  it("never issues an unscoped organization query", async () => {
    // The legacy getUserOrganization fell back to prisma.organization.findMany()
    // with no filter, so a user in no organizations was answered with every
    // organization in the installation.
    await request(app).get("/api/organizations").set(USER_HEADER, USER);

    for (const call of organizationModel.findMany.mock.calls) {
      expect(call[0].where).toBeDefined();
    }
  });

  it("answers an empty array for a user in no organizations", async () => {
    organizationModel.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/organizations")
      .set(USER_HEADER, USER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("does not require an active organization", async () => {
    // POST /organizations is how a user creates their first one, so the list
    // that shows them what they have cannot demand one.
    const res = await request(app)
      .get("/api/organizations")
      .set(USER_HEADER, USER);

    expect(res.status).not.toBe(400);
  });

  it("400s without a user and never touches the database", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app).get("/api/organizations");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(organizationModel.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/organizations/active", () => {
  it("returns the organization the session selected", async () => {
    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ORG);
  });

  it("reads the session by id and user, not by id alone", async () => {
    await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(sessionModel.findFirst).toHaveBeenCalledWith({
      where: {
        id: SESSION,
        userId: USER,
        // An expired or revoked session resolves nothing. `expiresAt` is on the
        // model and was not in the predicate, so a dead session id answered the
        // same as a live one.
        expiresAt: { gt: expect.any(Date) },
      },
      select: { activeOrganizationId: true },
    });
  });

  it("refuses a session whose expiry has passed", async () => {
    // The predicate above is what enforces this; the assertion is on the shape
    // because the mock cannot evaluate a `gt` against the clock.
    sessionModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(res.status).toBe(404);
    expect(organizationModel.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks membership before returning the organization", async () => {
    // The legacy getCurrentActiveOrganizationService was findUnique({ where: {
    // id: activeOrgId } }) with no membership check.
    await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(memberModel.findFirst).toHaveBeenCalledWith({
      where: { userId: USER, organizationId: ORG },
      select: { id: true, userId: true, organizationId: true, role: true },
    });
  });

  it("does not fall back to the first organization in the table", async () => {
    // The legacy fallback was organization.findFirst(), so a user with no active
    // organization was shown the first row in the database.
    sessionModel.findFirst.mockResolvedValue({ activeOrganizationId: null });

    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ACTIVE_ORGANIZATION");
    expect(organizationModel.findFirst).not.toHaveBeenCalled();
  });

  it("404s when the session names an organization the caller has left", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ACTIVE_ORGANIZATION");
  });

  it("404s when the session is not the caller's", async () => {
    sessionModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ACTIVE_ORGANIZATION");
  });

  it("400s without a session and never touches the database", async () => {
    const res = await request(app)
      .get("/api/organizations/active")
      .set(USER_HEADER, USER);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SESSION_REQUIRED");
    expect(sessionModel.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/organizations", () => {
  it("creates the organization and answers 201 with it", async () => {
    const res = await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(ORG);
  });

  it("supplies the id and createdAt the model has no default for", async () => {
    await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    const { data } = organizationModel.create.mock.calls[0][0];

    // Organization has no @default(cuid()) and no @default(now()) -- better-auth
    // supplied all three in the legacy, direct writes do not.
    expect(typeof data.id).toBe("string");
    expect(data.id.length).toBeGreaterThan(0);
    expect(data.createdAt).toBeInstanceOf(Date);
  });

  it("adds the creator as an owner member", async () => {
    await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    const { data } = organizationModel.create.mock.calls[0][0];

    expect(data.members.create).toMatchObject({ userId: USER, role: "owner" });
  });

  it("points the user at the new organization and completes their form", async () => {
    await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    expect(userModel.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { organizationId: ORG, isFormComplete: true },
    });
  });

  it("creates the organization and updates the user in one transaction", async () => {
    await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    expect(dbStub.$transaction).toHaveBeenCalledTimes(1);
  });

  it("trims the name", async () => {
    await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send({ ...validBody, name: "  Acme Distribution  " });

    expect(organizationModel.create.mock.calls[0][0].data.name).toBe(
      "Acme Distribution"
    );
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send({ ...validBody, name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(organizationModel.create).not.toHaveBeenCalled();
  });

  it("rejects a slug with a space or a slash", async () => {
    // The column accepts anything and the value ends up in a path segment, so
    // the shape is enforced here.
    for (const slug of ["Acme Distribution", "acme/distribution", "acme_1"]) {
      const res = await request(app)
        .post("/api/organizations")
        .set(USER_HEADER, USER)
        .send({ ...validBody, slug });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    }

    expect(organizationModel.create).not.toHaveBeenCalled();
  });

  it("accepts lowercase letters, numbers and single hyphens", async () => {
    for (const slug of ["acme", "acme-1", "acme-distribution-2"]) {
      const res = await request(app)
        .post("/api/organizations")
        .set(USER_HEADER, USER)
        .send({ ...validBody, slug });

      expect(res.status).toBe(201);
    }
  });

  it("rejects a request with no user", async () => {
    vi.stubEnv(USER_ENV_VAR, "");

    const res = await request(app).post("/api/organizations").send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });

  it("409s on a slug another organization already holds", async () => {
    organizationModel.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["slug"] },
      name: "PrismaClientKnownRequestError",
    });

    const res = await request(app)
      .post("/api/organizations")
      .set(USER_HEADER, USER)
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("UNIQUE_CONSTRAINT");
  });
});

describe("POST /api/organizations/set-active", () => {
  it("switches the caller's own session and answers 204", async () => {
    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION)
      .send({ organizationId: ORG });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(sessionModel.updateMany).toHaveBeenCalledWith({
      where: { id: SESSION, userId: USER },
      data: { activeOrganizationId: ORG },
    });
  });

  it("scopes the session write by user as well as by id", async () => {
    // The legacy setActiveOrganizationService did session.update({ where: { id:
    // sessionId } }), so naming another user's session id moved that user's
    // active organization.
    await request(app)
      .post("/api/organizations/set-active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION)
      .send({ organizationId: ORG });

    expect(sessionModel.updateMany.mock.calls[0][0].where).toEqual({
      id: SESSION,
      userId: USER,
    });
  });

  it("403s for an organization the caller is not a member of", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION)
      .send({ organizationId: "org_other" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_A_MEMBER");
    expect(sessionModel.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a missing organizationId", async () => {
    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(USER_HEADER, USER)
      .set(SESSION_HEADER, SESSION)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(memberModel.findFirst).not.toHaveBeenCalled();
  });

  it("400s without a session", async () => {
    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(USER_HEADER, USER)
      .send({ organizationId: ORG });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SESSION_REQUIRED");
    expect(memberModel.findFirst).not.toHaveBeenCalled();
  });
});

describe("the other routers are unaffected", () => {
  it("still requires an organization", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("does not accept the user header in place of an organization", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set(USER_HEADER, USER);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });
});
