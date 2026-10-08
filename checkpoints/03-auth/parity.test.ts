/**
 * Checkpoint 3 — Auth: Parity Test
 *
 * Runs the default session mode against a real PostgreSQL: better-auth writes
 * real `user`, `account`, `session`, `organization` and `member` rows, and every
 * assertion about who the caller is reads one of them back. The header-trust
 * mode the checkpoint 2 suites use is not involved anywhere in this file, which
 * is the point -- several tests below send the old `x-organization-id` /
 * `x-user-id` headers and assert they change nothing.
 *
 * The original stub used a fixed `test@example.com`, so its second run failed on
 * the unique email index, and five of its eight `it` blocks were empty. Every
 * user here is minted per run and removed in `afterAll`.
 *
 * Deviations from the stub, each deliberate:
 * - `GET /api/auth/get-session`, not `/api/auth/session`: the former is the
 *   route better-auth serves.
 * - Users authenticate with `Authorization: Bearer <token>` (the `bearer`
 *   plugin). The cookie path is asserted once; after that the bearer header is
 *   simpler to thread through supertest and exercises the same session lookup.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../apps/server/src/app";
import { createAuth } from "../../apps/server/src/auth";
import type { Email } from "../../apps/server/src/auth/email";
import {
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../../apps/server/src/middleware/auth-context";
import { hasDatabase, prisma, request, unique } from "../support/parity-db";

const PASSWORD = "correct-horse-battery";

describe.skipIf(!hasDatabase)("Checkpoint 3 — Auth", () => {
  const app = createApp({
    authMode: "session",
    auth: createAuth({ requireEmailVerification: false }),
  });

  const sent: Email[] = [];

  const verifyingApp = createApp({
    authMode: "session",
    auth: createAuth({
      requireEmailVerification: true,
      sendEmail: async (email) => {
        sent.push(email);
      },
    }),
  });

  const emails: string[] = [];
  const organizationIds: string[] = [];

  const newEmail = (label: string) => {
    const email = `${unique(label)}@example.test`.toLowerCase();
    emails.push(email);

    return email;
  };

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Sign up and return the session token better-auth issued. */
  async function signUp(label: string): Promise<{ email: string; token: string; userId: string }> {
    const email = newEmail(label);

    const res = await request(app)
      .post("/api/auth/sign-up/email")
      .send({ name: `Auth ${label}`, email, password: PASSWORD });

    expect(res.status).toBe(200);

    return { email, token: res.body.token, userId: res.body.user.id };
  }

  async function createOrganization(token: string, name: string): Promise<string> {
    const res = await request(app)
      .post("/api/auth/organization/create")
      .set(bearer(token))
      .send({ name, slug: unique("slug").toLowerCase() });

    expect(res.status).toBe(200);
    organizationIds.push(res.body.id);

    return res.body.id;
  }

  async function setActive(token: string, organizationId: string) {
    return request(app)
      .post("/api/auth/organization/set-active")
      .set(bearer(token))
      .send({ organizationId });
  }

  afterAll(async () => {
    if (!hasDatabase) return;
    // Categories first: they hold the organization reference without a cascade
    // path the organization delete can take on its own.
    await prisma.category.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    // Sessions, accounts and memberships cascade from the user.
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  describe("email and password", () => {
    it("POST /api/auth/sign-up/email creates the user and stores only a hash", async () => {
      const email = newEmail("signup");

      const res = await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Test User", email, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email, role: "user" });

      const account = await prisma.account.findFirstOrThrow({
        where: { user: { email }, providerId: "credential" },
      });

      expect(account.password).toBeTruthy();
      expect(account.password).not.toContain(PASSWORD);
    });

    it("refuses a second sign-up with the same email", async () => {
      const { email } = await signUp("dup");

      const res = await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Again", email, password: PASSWORD });

      expect(res.status).toBe(422);
    });

    it("ignores a client supplied organizationId at sign-up", async () => {
      const email = newEmail("forged");

      const res = await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Forger", email, password: PASSWORD, organizationId: "org_someone_else" });

      // better-auth refuses a field marked `input: false` outright rather than
      // dropping it, which is the louder and therefore better outcome.
      expect(res.status).toBe(400);
      expect(await prisma.user.findFirst({ where: { email } })).toBeNull();
    });

    it("POST /api/auth/sign-in/email logs in and returns a token", async () => {
      const { email } = await signUp("signin");

      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(await prisma.session.count({ where: { token: res.body.token } })).toBe(1);
    });

    it("rejects a wrong password", async () => {
      const { email } = await signUp("wrongpw");

      const res = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: "not-the-password" });

      expect(res.status).toBe(401);
    });
  });

  describe("sessions", () => {
    it("GET /api/auth/get-session returns the session for a bearer token", async () => {
      const { token, userId } = await signUp("session");

      const res = await request(app).get("/api/auth/get-session").set(bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(userId);
    });

    it("also accepts the session cookie better-auth sets", async () => {
      const email = newEmail("cookie");
      await request(app)
        .post("/api/auth/sign-up/email")
        .send({ name: "Cookie", email, password: PASSWORD });

      const signIn = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD });

      const cookies = ([] as string[]).concat(signIn.headers["set-cookie"] ?? []);
      expect(cookies.some((c) => c.includes("session_token"))).toBe(true);

      const res = await request(app)
        .get("/api/auth/get-session")
        .set("Cookie", cookies.map((c) => c.split(";")[0]).join("; "));

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
    });

    it("POST /api/auth/sign-out ends the session", async () => {
      const { token } = await signUp("signout");

      const res = await request(app).post("/api/auth/sign-out").set(bearer(token));

      expect(res.status).toBe(200);
      expect(await prisma.session.count({ where: { token } })).toBe(0);
      const after = await request(app).get("/api/auth/get-session").set(bearer(token));
      expect(after.body).toBeNull();
    });
  });

  describe("the API behind the session", () => {
    it("unauthenticated requests return 401", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("the old tenant headers authenticate nobody", async () => {
      const { userId } = await signUp("headers");
      const { token } = await signUp("headers-owner");
      const organizationId = await createOrganization(token, "Header Target");

      const res = await request(app)
        .get("/api/products")
        .set(ORGANIZATION_HEADER, organizationId)
        .set(USER_HEADER, userId);

      expect(res.status).toBe(401);
    });

    it("a user with no organization yet is told to pick one, not let in", async () => {
      const { token } = await signUp("noorg");

      const res = await request(app).get("/api/categories").set(bearer(token));

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
    });

    it("the bootstrap routes need a session but no organization", async () => {
      const { token } = await signUp("bootstrap");

      const anonymous = await request(app).get("/api/organizations");
      const signedIn = await request(app).get("/api/organizations").set(bearer(token));

      expect(anonymous.status).toBe(401);
      expect(signedIn.status).toBe(200);
    });

    it("a removed member's session stops reaching the organization", async () => {
      const owner = await signUp("evict-owner");
      const organizationId = await createOrganization(owner.token, "Eviction");
      const staff = await signUp("evict-staff");
      await prisma.member.create({
        data: {
          id: unique("mem"),
          organizationId,
          userId: staff.userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      expect((await setActive(staff.token, organizationId)).status).toBe(200);
      expect((await request(app).get("/api/categories").set(bearer(staff.token))).status).toBe(200);

      await prisma.member.deleteMany({ where: { organizationId, userId: staff.userId } });

      // The session row still names the organization -- removing a member does
      // not rewrite their sessions -- so only the per-request membership check
      // stands between them and the tenant's data.
      const session = await prisma.session.findFirstOrThrow({ where: { token: staff.token } });
      expect(session.activeOrganizationId).toBe(organizationId);
      const res = await request(app).get("/api/categories").set(bearer(staff.token));
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
    });
  });

  describe("organizations", () => {
    it("organization creation works and makes the creator its owner", async () => {
      const { token, userId } = await signUp("orgcreate");

      const organizationId = await createOrganization(token, "Created");

      const membership = await prisma.member.findUniqueOrThrow({
        where: { organizationId_userId: { organizationId, userId } },
      });

      expect(membership.role).toBe("owner");
      const session = await prisma.session.findFirstOrThrow({ where: { token } });
      expect(session.activeOrganizationId).toBe(organizationId);

      const res = await request(app)
        .post("/api/categories")
        .set(bearer(token))
        .send({ name: unique("Beverages") });

      expect(res.status).toBe(201);
      const category = await prisma.category.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(category.organizationId).toBe(organizationId);
    });

    it("organization switching works, and moves where writes land", async () => {
      const { token } = await signUp("orgswitch");
      const first = await createOrganization(token, "First");
      const second = await createOrganization(token, "Second");

      expect((await setActive(token, first)).status).toBe(200);

      const inFirst = await request(app)
        .post("/api/categories")
        .set(bearer(token))
        .send({ name: unique("First Category") });

      expect((await setActive(token, second)).status).toBe(200);

      const inSecond = await request(app)
        .post("/api/categories")
        .set(bearer(token))
        .send({ name: unique("Second Category") });

      expect((await prisma.category.findUniqueOrThrow({ where: { id: inFirst.body.id } })).organizationId).toBe(first);
      expect((await prisma.category.findUniqueOrThrow({ where: { id: inSecond.body.id } })).organizationId).toBe(second);

      // Scoped reads follow the switch too: the first tenant's row is not
      // visible from the second.
      const read = await request(app).get(`/api/categories/${inFirst.body.id}`).set(bearer(token));
      expect(read.status).toBe(404);
    });

    it("refuses to switch into an organization the user does not belong to", async () => {
      const outsider = await signUp("outsider");
      const owner = await signUp("victim-owner");
      const victim = await createOrganization(owner.token, "Victim");

      const res = await setActive(outsider.token, victim);

      expect(res.status).toBe(403);
      const session = await prisma.session.findFirstOrThrow({ where: { token: outsider.token } });
      expect(session.activeOrganizationId).toBeNull();
    });

    it("a new session starts in the user's first organization", async () => {
      const { email, token } = await signUp("firstorg");
      const organizationId = await createOrganization(token, "Home");

      const signIn = await request(app)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD });

      const session = await prisma.session.findFirstOrThrow({ where: { token: signIn.body.token } });
      expect(session.activeOrganizationId).toBe(organizationId);
    });
  });

  describe("admin plugin", () => {
    it("a new user is not an administrator", async () => {
      const { token } = await signUp("plain");

      const res = await request(app).get("/api/auth/admin/list-users").set(bearer(token));

      expect(res.status).toBe(403);
    });

    it("admin can manage users", async () => {
      const admin = await signUp("admin");
      await prisma.user.update({ where: { id: admin.userId }, data: { role: "admin" } });

      const list = await request(app)
        .get("/api/auth/admin/list-users")
        .query({ searchField: "email", searchValue: admin.email, searchOperator: "contains" })
        .set(bearer(admin.token));

      expect(list.status).toBe(200);
      expect(list.body.users.map((u: { id: string }) => u.id)).toContain(admin.userId);

      const email = newEmail("staff");

      const created = await request(app)
        .post("/api/auth/admin/create-user")
        .set(bearer(admin.token))
        .send({ email, password: PASSWORD, name: "Staff", role: "user" });

      expect(created.status).toBe(200);
      expect(await prisma.user.count({ where: { email } })).toBe(1);

      const removed = await request(app)
        .post("/api/auth/admin/remove-user")
        .set(bearer(admin.token))
        .send({ userId: created.body.user.id });

      expect(removed.status).toBe(200);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });
  });

  describe("email verification", () => {
    it("blocks sign-in until the emailed link is followed", async () => {
      const email = newEmail("verify");

      const signUpRes = await request(verifyingApp)
        .post("/api/auth/sign-up/email")
        .send({ name: "Verify", email, password: PASSWORD });

      expect(signUpRes.status).toBe(200);

      const message = sent.find((m) => m.to === email);
      expect(message?.subject).toBe("Email Verification");

      const blocked = await request(verifyingApp)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD });

      expect(blocked.status).toBe(403);

      const url = new URL(/https?:\/\/\S+/.exec(message!.html)![0]);
      await request(verifyingApp).get(`${url.pathname}${url.search}`);
      expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerified).toBe(true);

      const allowed = await request(verifyingApp)
        .post("/api/auth/sign-in/email")
        .send({ email, password: PASSWORD });

      expect(allowed.status).toBe(200);
    });
  });
});
