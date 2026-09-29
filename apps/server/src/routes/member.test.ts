import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { USER_HEADER } from "../middleware/auth-context";

const { memberModel, userModel, dbStub } = vi.hoisted(() => {
  const member = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const user = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  };

  return {
    memberModel: member,
    userModel: user,
    dbStub: { $transaction: vi.fn(), member, user },
  };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const app = createApp();

const OWNER = "user_owner";
const STRANGER = "user_stranger";
const TARGET = "user_target";
const ORG = "org_1";

const asCaller = (req: request.Test) => req.set(USER_HEADER, OWNER);

const memberFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "mem_1",
  organizationId: ORG,
  userId: OWNER,
  role: "owner",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const userFixture = (overrides: Record<string, unknown> = {}) => ({
  id: TARGET,
  name: "Target User",
  email: "target@example.com",
  image: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: the caller is an owner of ORG, and nobody else is a member of it.
  // Tests that need a different caller override this.
  memberModel.findFirst.mockImplementation(async ({ where }) => {
    if (where.id) {
      return memberFixture(where);
    }
    return where.userId === OWNER ? memberFixture({ userId: where.userId }) : null;
  });
  memberModel.findMany.mockResolvedValue([memberFixture()]);
  memberModel.count.mockResolvedValue(2);
  memberModel.create.mockImplementation(async ({ data }) => memberFixture(data));
  memberModel.update.mockImplementation(async ({ data }) =>
    memberFixture(data)
  );
  memberModel.delete.mockResolvedValue({ id: "mem_2" });
  userModel.findMany.mockResolvedValue([userFixture()]);
  userModel.findFirst.mockResolvedValue({ id: TARGET });
});

describe("GET /api/organizations/:id/members", () => {
  it("returns the members of the organization in the path", async () => {
    const res = await asCaller(request(app).get(`/api/organizations/${ORG}/members`));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(memberModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } })
    );
  });

  it("selects only what a member row needs to render", async () => {
    // The legacy getUsers returned whole User rows, carrying banned, banReason,
    // isOwner, role and isFormComplete into a table that has no use for them.
    await asCaller(request(app).get(`/api/organizations/${ORG}/members`));

    const select = memberModel.findMany.mock.calls[0][0].select;
    expect(Object.keys(select.user.select).sort()).toEqual([
      "email",
      "id",
      "image",
      "name",
    ]);
    expect(select.user.select.banned).toBeUndefined();
    expect(select.user.select.isOwner).toBeUndefined();
  });

  it("400s without a user context", async () => {
    const res = await request(app).get(`/api/organizations/${ORG}/members`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(memberModel.findMany).not.toHaveBeenCalled();
  });

  it("does not require the tenant header the other routers need", async () => {
    // The organization is named in the path, so demanding it a second time in a
    // header is a second source of tenant truth that can contradict the first.
    // The strict middleware would answer 400 ORGANIZATION_REQUIRED here.
    const res = await asCaller(
      request(app).get(`/api/organizations/${ORG}/members`)
    );

    expect(res.status).toBe(200);
  });
});

describe("GET /api/organizations/:id/available-users", () => {
  it("never returns a user from another organization", async () => {
    // The legacy getUsers filtered by "not a member of this org" and nothing
    // else, so it answered with every other tenant's users and email addresses
    // in a dropdown labelled "add someone to your organization".
    await asCaller(request(app).get(`/api/organizations/${ORG}/available-users`));

    const where = userModel.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
  });

  it("excludes the members of this organization", async () => {
    memberModel.findMany.mockResolvedValue([memberFixture({ userId: OWNER })]);

    await asCaller(request(app).get(`/api/organizations/${ORG}/available-users`));

    expect(userModel.findMany.mock.calls[0][0].where.id).toEqual({
      notIn: [OWNER],
    });
  });

  it("selects only id, name, email and image", async () => {
    await asCaller(request(app).get(`/api/organizations/${ORG}/available-users`));

    expect(
      Object.keys(userModel.findMany.mock.calls[0][0].select).sort()
    ).toEqual(["email", "id", "image", "name"]);
  });

  it("400s without a user context", async () => {
    const res = await request(app).get(`/api/organizations/${ORG}/available-users`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
  });
});

describe("POST /api/organizations/:id/members", () => {
  const add = (body: Record<string, unknown>) =>
    asCaller(request(app).post(`/api/organizations/${ORG}/members`).send(body));

  it("creates the membership with the role from the body", async () => {
    const res = await add({ userId: TARGET, role: "member" });

    expect(res.status).toBe(201);
    expect(memberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: ORG, userId: TARGET }),
      })
    );
  });

  it("defaults the role to member", async () => {
    await add({ userId: TARGET });

    expect(memberModel.create.mock.calls[0][0].data.role).toBe("member");
  });

  it("supplies the id and createdAt better-auth would have", async () => {
    await add({ userId: TARGET });

    const data = memberModel.create.mock.calls[0][0].data;
    expect(data.id).toEqual(expect.any(String));
    expect(data.createdAt).toBeInstanceOf(Date);
  });

  it("403s a caller who is not a member of the organization", async () => {
    // The legacy was a bare auth.api.addMember call with no check of its own.
    const res = await request(app)
      .post(`/api/organizations/${ORG}/members`)
      .set(USER_HEADER, STRANGER)
      .send({ userId: TARGET });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_A_MEMBER");
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it("403s a plain member of the organization", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.userId === OWNER
        ? memberFixture({ userId: where.userId, role: "member" })
        : null
    );

    const res = await add({ userId: TARGET });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_ROLE");
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it("treats adminRole as elevated", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.userId === OWNER
        ? memberFixture({ userId: where.userId, role: "adminRole" })
        : null
    );

    const res = await add({ userId: TARGET });

    expect(res.status).toBe(201);
  });

  it("does not treat a differently-cased role as elevated", async () => {
    // prisma/seed.ts writes "ADMIN" and this comparison is case-sensitive on
    // purpose: guessing at a role string is how privilege gets granted by
    // accident. Checkpoint 6 reconciles the vocabulary.
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.userId === OWNER
        ? memberFixture({ userId: where.userId, role: "ADMIN" })
        : null
    );

    const res = await add({ userId: TARGET });

    expect(res.status).toBe(403);
  });

  it("404s a user id that does not exist", async () => {
    userModel.findFirst.mockResolvedValue(null);

    const res = await add({ userId: "user_nope" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("USER_NOT_FOUND");
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it("409s a user who is already a member", async () => {
    // Member has no unique index on (organizationId, userId), so a second insert
    // succeeds and leaves two rows for one user.
    const res = await add({ userId: OWNER });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_A_MEMBER");
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it("400s an unknown role", async () => {
    const res = await add({ userId: TARGET, role: "superuser" });

    expect(res.status).toBe(400);
    expect(memberModel.create).not.toHaveBeenCalled();
  });

  it("400s a missing body", async () => {
    const res = await add({ role: "member" });

    expect(res.status).toBe(400);
    expect(memberModel.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/members/:id", () => {
  it("deletes the membership", async () => {
    const res = await asCaller(request(app).delete("/api/members/mem_2"));

    expect(res.status).toBe(204);
    expect(memberModel.delete).toHaveBeenCalled();
  });

  it("scopes the delete by organization, not by bare member id", async () => {
    // The legacy deleted on `where: { id }` with no organization and no user.
    await asCaller(request(app).delete("/api/members/mem_2"));

    expect(memberModel.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mem_2", organizationId: ORG } })
    );
  });

  it("actually enforces the admin check the legacy tested as a function", async () => {
    // src/services/member.ts was:
    //   const admin = await isAdmin()
    //   if (!isAdmin) { return { success: false, ... } }
    // `isAdmin` is a function, so it is always truthy and the guard never fired.
    const res = await request(app)
      .delete("/api/members/mem_2")
      .set(USER_HEADER, STRANGER);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_A_MEMBER");
    expect(memberModel.delete).not.toHaveBeenCalled();
  });

  it("403s a plain member", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "member" })
        : memberFixture({ userId: where.userId, role: "member" })
    );

    const res = await asCaller(request(app).delete("/api/members/mem_2"));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_ROLE");
    expect(memberModel.delete).not.toHaveBeenCalled();
  });

  it("404s a member id that does not exist", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await asCaller(request(app).delete("/api/members/mem_nope"));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MEMBER_NOT_FOUND");
    expect(memberModel.delete).not.toHaveBeenCalled();
  });

  it("checks the caller against the member's own organization", async () => {
    await asCaller(request(app).delete("/api/members/mem_2"));

    // The membership is read to learn its organization, then the caller's
    // membership in *that* organization is what authorises the delete.
    expect(memberModel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: OWNER, organizationId: ORG } })
    );
  });

  it("refuses to remove the last owner", async () => {
    // Nobody would be left able to add anyone back, and the database is happy
    // with that: the last row is a perfectly valid member.
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "owner" })
        : memberFixture({ userId: where.userId, role: "owner" })
    );
    memberModel.count.mockResolvedValue(1);

    const res = await asCaller(request(app).delete("/api/members/mem_2"));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_OWNER");
    expect(memberModel.delete).not.toHaveBeenCalled();
  });

  it("removes an owner when a second one remains", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "owner" })
        : memberFixture({ userId: where.userId, role: "owner" })
    );
    memberModel.count.mockResolvedValue(2);

    const res = await asCaller(request(app).delete("/api/members/mem_2"));

    expect(res.status).toBe(204);
  });

  it("removes a non-owner without consulting the owner count", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "member" })
        : memberFixture({ userId: where.userId })
    );

    const res = await asCaller(request(app).delete("/api/members/mem_2"));

    expect(res.status).toBe(204);
    expect(memberModel.count).not.toHaveBeenCalled();
  });

  it("400s without a user context", async () => {
    const res = await request(app).delete("/api/members/mem_2");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("USER_REQUIRED");
    expect(memberModel.findFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/members/:id/role", () => {
  it("updates the role scoped by organization", async () => {
    const res = await asCaller(
      request(app).patch("/api/members/mem_2/role").send({ role: "adminRole" })
    );

    expect(res.status).toBe(200);
    expect(memberModel.update).toHaveBeenCalledWith({
      where: { id: "mem_2", organizationId: ORG },
      data: { role: "adminRole" },
      select: expect.any(Object),
    });
  });

  it("403s a stranger", async () => {
    const res = await request(app)
      .patch("/api/members/mem_2/role")
      .set(USER_HEADER, STRANGER)
      .send({ role: "adminRole" });

    expect(res.status).toBe(403);
    expect(memberModel.update).not.toHaveBeenCalled();
  });

  it("refuses to demote the last owner", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "owner" })
        : memberFixture({ userId: where.userId, role: "owner" })
    );
    memberModel.count.mockResolvedValue(1);

    const res = await asCaller(
      request(app).patch("/api/members/mem_2/role").send({ role: "member" })
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_OWNER");
    expect(memberModel.update).not.toHaveBeenCalled();
  });

  it("allows the last owner to be re-affirmed as owner", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) =>
      where.id
        ? memberFixture({ id: where.id, role: "owner" })
        : memberFixture({ userId: where.userId, role: "owner" })
    );
    memberModel.count.mockResolvedValue(1);

    const res = await asCaller(
      request(app).patch("/api/members/mem_2/role").send({ role: "owner" })
    );

    expect(res.status).toBe(200);
  });

  it("400s an unknown role", async () => {
    const res = await asCaller(
      request(app).patch("/api/members/mem_2/role").send({ role: "root" })
    );

    expect(res.status).toBe(400);
    expect(memberModel.update).not.toHaveBeenCalled();
  });

  it("404s a member id that does not exist", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await asCaller(
      request(app).patch("/api/members/mem_2/role").send({ role: "member" })
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MEMBER_NOT_FOUND");
  });
});

describe("the member mounts terminate themselves", () => {
  it("404s an unknown path under /api/members", async () => {
    // Otherwise it would reach authContext and answer 400
    // ORGANIZATION_REQUIRED for a path that does not exist.
    const res = await asCaller(request(app).post("/api/members/mem_2"));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROUTE_NOT_FOUND");
  });

  it("404s an unknown path under /api/organizations rather than 400ing on the tenant header", async () => {
    const res = await asCaller(
      request(app).post(`/api/organizations/${ORG}/members/extra`)
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROUTE_NOT_FOUND");
  });

  it("does not shadow the organization routes", async () => {
    const res = await asCaller(
      request(app).get(`/api/organizations/${ORG}/members`)
    );

    expect(res.status).toBe(200);
  });
});
