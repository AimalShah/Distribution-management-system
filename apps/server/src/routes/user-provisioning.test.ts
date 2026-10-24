import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Auth } from "../auth";
import { USER_HEADER } from "../middleware/auth-context";

const { userModel, accountModel, memberModel, sessionModel, dbStub } =
  vi.hoisted(() => {
    const user = {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    const account = { create: vi.fn() };

    const member = {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    };

    const session = { deleteMany: vi.fn() };

    return {
      userModel: user,
      accountModel: account,
      memberModel: member,
      sessionModel: session,
      dbStub: {
        $transaction: vi.fn(),
        user,
        account,
        member,
        session,
      },
    };
  });

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

/**
 * Same routine the real service shares with better-auth; mocked to observe the
 * call, not the hash.
 */
const hashPassword = vi.hoisted(() => vi.fn());

vi.mock("better-auth/crypto", () => ({ hashPassword }));

const OWNER = "user_owner";

const ORG = "org_1";

const caller = (req: request.Test) => req.set(USER_HEADER, OWNER);

const memberFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "mem_1",
  organizationId: ORG,
  userId: OWNER,
  role: "owner",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

/**
 * Default membership mock:
 * - `{ id, userId }` (the self-deactivation check): always null -- the caller
 *   is acting on someone else's membership.
 * - `{ id }` only (a member write reads its target): the row, whose user is
 *   `TARGET_USER`, not the caller.
 * - `{ userId, organizationId }` (the elevated guard): the caller is an owner
 *   of the organization in the path and of nothing else.
 */
const TARGET_USER = "user_target";

const arrangeMembership = (callerOverrides: Record<string, unknown> = {}) => {
  memberModel.findFirst.mockImplementation(async ({ where }) => {
    if (where.id !== undefined && where.userId !== undefined) {
      return null;
    }

    if (where.id) {
      return memberFixture({ id: where.id, userId: TARGET_USER });
    }

    if (where.userId === OWNER && where.organizationId === ORG) {
      return memberFixture({
        userId: where.userId,
        organizationId: where.organizationId,
        ...callerOverrides,
      });
    }

    return null;
  });
};

beforeEach(() => {
  vi.clearAllMocks();

  hashPassword.mockResolvedValue("hashed(temp)");

  arrangeMembership();

  memberModel.count.mockResolvedValue(2);
  memberModel.create.mockImplementation(async ({ data }) =>
    memberFixture({ ...data })
  );
  userModel.findFirst.mockResolvedValue(null);
  userModel.create.mockImplementation(async ({ data }) => ({
    id: data.id,
    name: data.name,
    email: data.email,
  }));
  userModel.update.mockImplementation(async ({ data }) => ({
    id: "user_target",
    ...data,
  }));
  accountModel.create.mockResolvedValue({});
  sessionModel.deleteMany.mockResolvedValue({ count: 1 });

  dbStub.$transaction.mockImplementation(async (fn) => fn(dbStub));
});

/**
 * `app` for the two member mounts. The suite runs in trusted-proxy mode (the
 * vitest config sets it), like the rest of the route suites: the caller's id
 * arrives on `x-user-id`, and what is under test are the routes' own writes
 * and guards.
 */
const app = createApp();

describe("POST /api/organizations/:id/staff", () => {
  const addStaff = (body: Record<string, unknown>) =>
    caller(request(app).post(`/api/organizations/${ORG}/staff`)).send(body);

  it("creates the user, the credential account, and the membership in one transaction", async () => {
    const res = await addStaff({
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
      tempPassword: "temporary-pass-1",
      role: "member",
    });

    expect(res.status).toBe(201);

    // All three inserts run inside the single $transaction.
    expect(dbStub.$transaction).toHaveBeenCalledTimes(1);
    expect(userModel.create).toHaveBeenCalledTimes(1);
    expect(accountModel.create).toHaveBeenCalledTimes(1);
    expect(memberModel.create).toHaveBeenCalledTimes(1);
  });

  it("provisions the account the way better-auth's own sign-up would", async () => {
    await addStaff({
      name: "Ayesha Staff",
      email: "Ayesha@Am-Enterprise.org",
      tempPassword: "temporary-pass-1",
    });

    const user = userModel.create.mock.calls[0][0].data;
    expect(user.email).toBe("ayesha@am-enterprise.org"); // lower-cased
    expect(user.emailVerified).toBe(true); // the owner vouches for the address
    expect(user.organizationId).toBe(ORG);
    expect(user.mustChangePassword).toBe(true); // the forced first change
    expect(user.id).toEqual(expect.any(String));
    expect(user.createdAt).toBeInstanceOf(Date);

    const account = accountModel.create.mock.calls[0][0].data;
    expect(account.providerId).toBe("credential");
    expect(account.accountId).toBe(user.id);
    expect(account.userId).toBe(user.id);
    expect(account.password).toBe("hashed(temp)");
  });

  it("hashes the temporary password with better-auth's own routine", async () => {
    await addStaff({
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
      tempPassword: "temporary-pass-1",
    });

    expect(hashPassword).toHaveBeenCalledWith("temporary-pass-1");
    // The plaintext never reaches any model call.
    const writes = JSON.stringify([
      userModel.create.mock.calls,
      accountModel.create.mock.calls,
    ]);
    expect(writes).not.toContain("temporary-pass-1");
  });

  it("answers with the created user, never the password material", async () => {
    const res = await addStaff({
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
      tempPassword: "temporary-pass-1",
    });

    expect(res.body).toEqual({
      id: expect.any(String),
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
    });
  });

  it("409s an email that already has an account", async () => {
    userModel.findFirst.mockResolvedValue({ id: "user_taken" });

    const res = await addStaff({
      name: "Dup",
      email: "ayesha@am-enterprise.org",
      tempPassword: "temporary-pass-1",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_TAKEN");
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });

  it("400s a password shorter than 8 characters", async () => {
    const res = await addStaff({
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
      tempPassword: "short",
    });

    expect(res.status).toBe(400);
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });

  it("400s an email that is not an email", async () => {
    const res = await addStaff({
      name: "Ayesha Staff",
      email: "not-an-email",
      tempPassword: "temporary-pass-1",
    });

    expect(res.status).toBe(400);
  });

  it("403s a caller who is not a member of the organization", async () => {
    arrangeMembership({ role: "owner", userId: "user_other" });

    const res = await request(app)
      .post(`/api/organizations/${ORG}/staff`)
      .set(USER_HEADER, "user_stranger")
      .send({
        name: "Ayesha Staff",
        email: "ayesha@am-enterprise.org",
        tempPassword: "temporary-pass-1",
      });

    expect(res.status).toBe(403);
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });

  it("403s adminRole creating an owner account", async () => {
    // Creating a user with the owner role is granting ownership. Same rule as
    // `addMember`: owners grant ownership, admins do not.
    arrangeMembership({ role: "adminRole" });

    const res = await addStaff({
      name: "Ayesha Staff",
      email: "ayesha@am-enterprise.org",
      tempPassword: "temporary-pass-1",
      role: "owner",
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OWNER_REQUIRED_FOR_OWNERSHIP");
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });

  it("400s a missing body", async () => {
    const res = await addStaff({});

    expect(res.status).toBe(400);
    expect(dbStub.$transaction).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/members/:id/status", () => {
  it("deactivates: bans the user and deletes every session", async () => {
    arrangeMembership();

    const res = await caller(
      request(app).patch(`/api/members/mem_target/status`)
    ).send({ active: false, reason: "Left the company" });

    expect(res.status).toBe(200);

    // The user row is banned by id, with the reason recorded and no expiry.
    const update = userModel.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: TARGET_USER });
    expect(update.data.banned).toBe(true);
    expect(update.data.banReason).toBe("Left the company");
    expect(update.data.banExpires).toBeNull();

    // The sessions follow: the lockout is real the moment the write lands.
    expect(sessionModel.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET_USER },
    });

    expect(res.body).toEqual({
      id: "mem_target",
      userId: TARGET_USER,
      active: false,
    });
  });

  it("records a default reason when none is sent", async () => {
    await caller(request(app).patch(`/api/members/mem_target/status`)).send({
      active: false,
    });

    const update = userModel.update.mock.calls[0][0];
    expect(update.data.banReason).toBe("Deactivated by an administrator");
  });

  it("reactivates: clears all three ban columns and touches no session", async () => {
    const res = await caller(
      request(app).patch(`/api/members/mem_target/status`)
    ).send({ active: true });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);

    const update = userModel.update.mock.calls[0][0];
    expect(update.data).toEqual({ banned: false, banReason: null, banExpires: null });
    expect(sessionModel.deleteMany).not.toHaveBeenCalled();
  });

  it("403s a non-member caller", async () => {
    arrangeMembership({ role: "owner", userId: "user_other" });

    const res = await request(app)
      .patch(`/api/members/mem_target/status`)
      .set(USER_HEADER, "user_stranger")
      .send({ active: false });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_A_MEMBER");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("403s a plain member caller", async () => {
    arrangeMembership({ role: "member" });

    const res = await caller(
      request(app).patch(`/api/members/mem_target/status`)
    ).send({ active: false });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INSUFFICIENT_ROLE");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("refuses self-deactivation", async () => {
    // The caller deactivating themselves would lose the only session that could
    // ever reactivate the account.
    memberModel.findFirst.mockImplementation(async ({ where }) => {
      if (where.id !== undefined && where.userId !== undefined) {
        // The self-check by (id, userId) answers the caller's own row.
        return memberFixture({ id: where.id, userId: where.userId });
      }

      if (where.id) {
        return memberFixture({ id: where.id, userId: OWNER });
      }

      if (where.userId === OWNER && where.organizationId === ORG) {
        return memberFixture({ userId: where.userId, organizationId: where.organizationId });
      }

      return null;
    });

    const res = await caller(
      request(app).patch(`/api/members/mem_1/status`)
    ).send({ active: false });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CANNOT_DEACTIVATE_SELF");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("403s adminRole deactivating an owner", async () => {
    // Same ownership rule as role changes: only owners act on owners.
    arrangeMembership({ role: "adminRole", userId: OWNER, id: "mem_admin" });

    memberModel.findFirst.mockImplementation(async ({ where }) => {
      if (where.id !== undefined && where.userId !== undefined) return null;

      if (where.id) {
        return memberFixture({ id: where.id, role: "owner", userId: "user_owner2" });
      }

      if (where.userId === OWNER && where.organizationId === ORG) {
        return memberFixture({
          userId: where.userId,
          organizationId: where.organizationId,
          role: "adminRole",
        });
      }

      return null;
    });

    const res = await caller(
      request(app).patch(`/api/members/mem_owner/status`)
    ).send({ active: false });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OWNER_REQUIRED_FOR_OWNERSHIP");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("refuses to deactivate the last owner", async () => {
    memberModel.findFirst.mockImplementation(async ({ where }) => {
      if (where.id !== undefined && where.userId !== undefined) return null;

      if (where.id) {
        return memberFixture({
          id: where.id,
          role: "owner",
          userId: "user_owner2",
        });
      }

      if (where.userId === OWNER && where.organizationId === ORG) {
        return memberFixture({
          userId: where.userId,
          organizationId: where.organizationId,
          role: "owner",
        });
      }

      return null;
    });
    memberModel.count.mockResolvedValue(1);

    const res = await caller(
      request(app).patch(`/api/members/mem_owner/status`)
    ).send({ active: false });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_OWNER");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("lets adminRole reactivate an owner", async () => {
    // Reactivating widens access only; the ownership guard is for taking it
    // away, and a locked-out owner cannot reactivate themselves.
    memberModel.findFirst.mockImplementation(async ({ where }) => {
      if (where.id !== undefined && where.userId !== undefined) return null;

      if (where.id) {
        return memberFixture({
          id: where.id,
          role: "owner",
          userId: "user_owner2",
        });
      }

      if (where.userId === OWNER && where.organizationId === ORG) {
        return memberFixture({
          userId: where.userId,
          organizationId: where.organizationId,
          role: "adminRole",
        });
      }

      return null;
    });

    const res = await caller(
      request(app).patch(`/api/members/mem_owner/status`)
    ).send({ active: true });

    expect(res.status).toBe(200);
  });

  it("404s a member id that does not exist", async () => {
    memberModel.findFirst.mockResolvedValue(null);

    const res = await caller(
      request(app).patch(`/api/members/mem_nope/status`)
    ).send({ active: false });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("MEMBER_NOT_FOUND");
  });

  it("400s a body without the active flag", async () => {
    const res = await caller(
      request(app).patch(`/api/members/mem_target/status`)
    ).send({});

    expect(res.status).toBe(400);
    expect(userModel.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/users/me/password", () => {
  // The mount is behind the *session* middleware regardless of the suite's
  // trusted-proxy mode, so its tests drive `getSession` directly.
  const getSession = vi.fn();
  const changePassword = vi.fn();

  const auth = {
    api: {
      getSession,
      changePassword,
    },
  } as unknown as Auth;

  const sessionApp = createApp({ auth });

  const change = (body: Record<string, unknown>) =>
    request(sessionApp)
      .post(`/api/users/me/password`)
      .send(body);

  beforeEach(() => {
    getSession.mockResolvedValue({
      session: { id: "ses_1", activeOrganizationId: null },
      user: { id: "user_staff" },
    });
  });

  it("runs better-auth's change and clears mustChangePassword", async () => {
    const res = await change({
      currentPassword: "temporary-pass-1",
      newPassword: "the-real-password",
    });

    expect(res.status).toBe(204);
    expect(auth.api.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          currentPassword: "temporary-pass-1",
          newPassword: "the-real-password",
        },
      })
    );
    expect(userModel.update).toHaveBeenCalledWith({
      where: { id: "user_staff" },
      data: { mustChangePassword: false },
    });
  });

  it("400s and leaves the flag when the current password is wrong", async () => {
    changePassword.mockRejectedValue(new Error("Incorrect password"));

    const res = await change({
      currentPassword: "wrong",
      newPassword: "the-real-password",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PASSWORD_CHANGE_FAILED");
    expect(res.body.error).toContain("Incorrect password");
    expect(userModel.update).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await change({
      currentPassword: "temporary-pass-1",
      newPassword: "the-real-password",
    });

    expect(res.status).toBe(401);
    expect(auth.api.changePassword).not.toHaveBeenCalled();
  });

  it("400s a new password shorter than 8 characters", async () => {
    const res = await change({
      currentPassword: "temporary-pass-1",
      newPassword: "short",
    });

    expect(res.status).toBe(400);
    expect(auth.api.changePassword).not.toHaveBeenCalled();
    expect(userModel.update).not.toHaveBeenCalled();
  });
});
