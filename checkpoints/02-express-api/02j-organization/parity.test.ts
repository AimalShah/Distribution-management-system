/**
 * Checkpoint 2j — Organization API: Parity Test
 *
 * Scope: the routes behind `bootstrapAuthContext`, and the two data-driven
 * guarantees that only a real database can settle.
 *
 * **1. There is no fallback list.** The legacy `getUserOrganization` was
 *
 *   const orgs = await getUserOrganizationsService(curntUser.id)
 *   if (orgs && orgs.length > 0) return orgs
 *   const allOrgs = await prisma.organization.findMany()
 *   return allOrgs
 *
 * The fallback is unscoped. A user who was a member of nothing was answered with
 * every organization in the installation, including names, slugs and member lists,
 * and the caller rendered that list as their own. So the test that matters here is
 * not "does the list contain my organization" -- it is what a user with *zero*
 * memberships is given, and the answer has to be `[]` and specifically must not
 * contain another tenant's organization. That needs a second real organization in
 * the table to leak.
 *
 * **2. The active organization is the session's choice and nothing else.** The
 * legacy `getActiveOrganizationService` did `member.findFirst({ where: { userId }
 * })` and read that membership's organization, so the "active" tenant was whichever
 * row the database happened to return first: a dashboard could switch tenants
 * between two page loads. `getCurrentActiveOrganization` was worse, falling back to
 * `organization.findFirst()` -- the first row in the table -- so a brand new user
 * was shown somebody else's organization. Every one of those is a claim about row
 * order and absence, which is what makes them testable here and not before: a user
 * in two organizations, a session that has chosen one, a session that has not, an
 * expired session, a session belonging to someone else, and a session pointing at
 * an organization the user has since been removed from.
 *
 * `Session.expiresAt` is in the predicate. It is on the model and the legacy query
 * omitted it, so an expired or revoked session id resolved an active organization
 * just as a live one did. Under the stand-in middleware the session id is
 * client-chosen, so this is the difference between "a session the user still holds"
 * and "a string that matches a row".
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asSession,
  asUser,
  errorBody,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

describe.skipIf(!hasDatabase)("Checkpoint 2j — Organization API", () => {
  let t: Tenant;
  /** User ids this file creates, cleaned up after. */
  const made: string[] = [];
  const orgs: string[] = [];
  const sessions: string[] = [];

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (sessions.length) await prisma.session.deleteMany({ where: { id: { in: sessions } } });

    if (orgs.length) {
      // Cascades take the memberships and the invited users' member rows with it.
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    }

    if (made.length) {
      await prisma.inventoryLog.deleteMany({ where: { userId: { in: made } } });
      await prisma.user.deleteMany({ where: { id: { in: made } } });
    }

    if (t) await teardownTenants(t);
  });

  /** A user with no memberships anywhere. */
  const makeUser = async (label: string) => {
    const id = `usr_parity_${unique(label)}`;
    made.push(id);
    await prisma.user.create({
      data: {
        id,
        name: label,
        email: `${id}@parity.invalid`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return id;
  };

  /** A second organization, optionally with `ownerId` as a member. */
  const makeOrg = async (label: string, ownerId?: string) => {
    const id = `org_parity_${unique(label)}`;
    orgs.push(id);
    const at = new Date();
    await prisma.organization.create({
      data: {
        id,
        name: `${label} Ltd`,
        slug: id,
        createdAt: at,
        ...(ownerId
          ? {
              members: {
                create: { id: `mem_${unique("m")}`, userId: ownerId, role: "member", createdAt: at },
              },
            }
          : {}),
      },
    });

    return id;
  };

  const makeSession = async (userId: string, activeOrganizationId: string | null, expiresInMs = 3600_000) => {
    const id = `ses_${unique("s")}`;
    sessions.push(id);
    await prisma.session.create({
      data: {
        id,
        userId,
        token: `tok_${unique("t")}`,
        activeOrganizationId,
        expiresAt: new Date(Date.now() + expiresInMs),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return id;
  };

  const slug = (label: string) => `parity-${unique(label)}`;

  it("answers an empty list to a user with no memberships", async () => {
    // The legacy fallback answered this with every organization in the
    // installation. The seeded tenant is right there to leak.
    const nobody = await makeUser("nobody");

    const res = await request(app).get("/api/organizations").set(asUser("", nobody));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists only the organizations the caller is a member of", async () => {
    // The filter is a relation predicate: `members: { some: { userId } }`. A second
    // membership and a second organization on file are what make it observable.
    const userId = await makeUser("twobelongs");
    const mine = await makeOrg("first", userId);
    const alsoMine = await makeOrg("second", userId);
    const theirs = await makeOrg("theirs", t.userId);

    const res = await request(app).get("/api/organizations").set(asUser("", userId));

    expect(res.status).toBe(200);
    const ids = res.body.map((o: { id: string }) => o.id);
    expect(ids.sort()).toEqual([mine, alsoMine].sort());
    expect(ids).not.toContain(theirs);
    expect(ids).not.toContain(t.organizationId);
    // The list carries its member rows, which is what the switcher renders.
    expect(res.body[0].members).toHaveLength(1);
  });

  it("needs no organization header, because the tenant is what it is listing", async () => {
    // These routes sit behind `bootstrapAuthContext`, and requiring the tenant
    // header here would make the bootstrap path the one path that cannot be
    // bootstrapped: `POST /organizations` is how a user creates their first one.
    const res = await request(app).get("/api/organizations").set({ "x-user-id": t.userId });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("requires a user header", async () => {
    for (const path of ["/api/organizations", "/api/organizations/active"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: "USER_REQUIRED" });
    }
  });

  it("reports the organization the session chose, not the first membership", async () => {
    // The legacy read `member.findFirst({ where: { userId } })`, so this was
    // whichever row came back first and the dashboard could switch tenants between
    // two page loads. Two memberships and a deliberate choice make that visible.
    const userId = await makeUser("chooses");
    const first = await makeOrg("alpha", userId);
    const second = await makeOrg("beta", userId);
    const sessionId = await makeSession(userId, second);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(asSession("", sessionId, userId));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(second);
    expect(res.body.id).not.toBe(first);
  });

  it("has no active organization until the session chooses one", async () => {
    // The legacy fallback was `organization.findFirst()` -- the first row in the
    // table. So a brand new user was shown somebody else's organization. With two
    // organizations on file the difference is unambiguous.
    const userId = await makeUser("undecided");
    await makeOrg("gamma", userId);
    await makeOrg("delta", userId);
    const sessionId = await makeSession(userId, null);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(asSession("", sessionId, userId));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NO_ACTIVE_ORGANIZATION" });
  });

  it("ignores an expired session", async () => {
    // `expiresAt` is in the predicate. The legacy query omitted it, so a revoked
    // session id resolved an active organization just as a live one did.
    const userId = await makeUser("expired");
    const orgId = await makeOrg("epsilon", userId);
    const sessionId = await makeSession(userId, orgId, -1000);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(asSession("", sessionId, userId));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NO_ACTIVE_ORGANIZATION" });
  });

  it("ignores another user's session, even named by the caller", async () => {
    // Both halves of the predicate matter: `id` alone would resolve the holder's
    // active organization to the caller.
    const caller = await makeUser("caller");
    const holder = await makeUser("holder");
    const theirs = await makeOrg("zeta", holder);
    const sessionId = await makeSession(holder, theirs);

    const res = await request(app)
      .get("/api/organizations/active")
      .set(asSession("", sessionId, caller));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NO_ACTIVE_ORGANIZATION" });
  });

  it("ignores a session pointing at an organization the user has left", async () => {
    // Scoped through the membership rather than read by bare id. The legacy read
    // was `organization.findUnique({ where: { id: activeOrgId } })`, so it would
    // hand back any organization in the database once the session still pointed at
    // one the user had been removed from.
    const userId = await makeUser("left");
    const left = await makeOrg("eta", userId);
    const sessionId = await makeSession(userId, left);

    await prisma.member.deleteMany({ where: { userId, organizationId: left } });

    const res = await request(app)
      .get("/api/organizations/active")
      .set(asSession("", sessionId, userId));

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NO_ACTIVE_ORGANIZATION" });
  });

  it("requires a session header on the two session routes", async () => {
    const noSession = await request(app).get("/api/organizations/active").set(asUser("", t.userId));
    expect(noSession.status).toBe(400);
    expect(noSession.body).toMatchObject({ code: "SESSION_REQUIRED" });

    const setActive = await request(app)
      .post("/api/organizations/set-active")
      .set(asUser("", t.userId))
      .send({ organizationId: t.organizationId });

    expect(setActive.status).toBe(400);
    expect(setActive.body).toMatchObject({ code: "SESSION_REQUIRED" });
  });

  it("records the choice on the caller's own session row", async () => {
    const userId = await makeUser("sets");
    const orgId = await makeOrg("theta", userId);
    const sessionId = await makeSession(userId, null);

    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(asSession("", sessionId, userId))
      .send({ organizationId: orgId });

    expect(res.status).toBe(204);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).activeOrganizationId
    ).toBe(orgId);
  });

  it("403s setting an organization the caller is not a member of", async () => {
    // 403 rather than 404: the organization may well exist, the caller simply is
    // not in it, and that is the useful thing to tell them.
    const userId = await makeUser("outsider");
    const sessionId = await makeSession(userId, null);

    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(asSession("", sessionId, userId))
      .send({ organizationId: t.organizationId });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
    // The claim in the body is not an authorisation, and the session is untouched.
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).activeOrganizationId
    ).toBeNull();
  });

  it("does not move another user's session, and says so", async () => {
    // The legacy checked the membership on the caller's own id and then wrote
    // `session.update({ where: { id: sessionId } })` -- the session id alone. A
    // caller naming another user's session moved that user's active organization
    // and the membership check would not notice.
    const caller = await makeUser("movecaller");
    const holder = await makeUser("moveholder");
    const callersOwn = await makeOrg("iota", caller);
    const holdersChoice = await makeOrg("kappa", holder);

    const callerSession = await makeSession(caller, callersOwn);
    const holderSession = await makeSession(holder, holdersChoice);

    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(asSession("", holderSession, caller))
      .send({ organizationId: callersOwn });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "SESSION_NOT_FOUND" });
    // The holder's session still points where it did.
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: holderSession } })).activeOrganizationId
    ).toBe(holdersChoice);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: callerSession } })).activeOrganizationId
    ).toBe(callersOwn);
  });

  it("404s rather than reporting a success for a session that matches no row", async () => {
    // The route answered 204 regardless of the count, so a caller naming a stale
    // session of their own got a success for a write that touched nothing.
    const userId = await makeUser("stale");
    const orgId = await makeOrg("lambda", userId);

    const res = await request(app)
      .post("/api/organizations/set-active")
      .set(asSession("", `ses_${unique("gone")}`, userId))
      .send({ organizationId: orgId });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("creates the organization, the owner membership, and the onboarding flag together", async () => {
    // Three writes the legacy did through better-auth's `createOrganization`, which
    // does not exist in this monorepo yet and arrives with Checkpoint 3. All three
    // happen here, in one transaction.
    const userId = await makeUser("founder");

    const res = await request(app)
      .post("/api/organizations")
      .set(asUser("", userId))
      .send({ name: "Parity Distribution", slug: slug("founder") });

    expect(res.status).toBe(201);
    orgs.push(res.body.id);

    const membership = await prisma.member.findFirstOrThrow({
      where: { organizationId: res.body.id, userId },
    });

    expect(membership.role).toBe("owner");

    // The dashboard and the onboarding redirect both read `isFormComplete`.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.isFormComplete).toBe(true);
    expect(user.organizationId).toBe(res.body.id);

    // And the new organization is immediately listable, with its owner on it.
    const list = await request(app).get("/api/organizations").set(asUser("", userId));
    expect(list.body.map((o: { id: string }) => o.id)).toContain(res.body.id);
  });

  it("rolls the organization back when the user row is not there", async () => {
    // The membership insert and the user update are one transaction, so a caller
    // id with no user row cannot leave an organization with an owner row pointing
    // at nobody.
    //
    // The owner membership is the *first* write to touch the caller id -- its
    // `Member.userId` is a foreign key -- so that is the constraint that fires,
    // before the service ever reaches its own `user.update`. Which constraint
    // reports first is an implementation detail; that nothing survives is the
    // point.
    const body = { name: "Rollback Ltd", slug: slug("rollback") };

    const res = await request(app)
      .post("/api/organizations")
      .set(asUser("", `usr_parity_${unique("ghost")}`))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.foreignKey);
    expect(await prisma.organization.count({ where: { slug: body.slug } })).toBe(0);
  });

  it("treats the slug as globally unique", async () => {
    const taken = slug("taken");

    const first = await request(app)
      .post("/api/organizations")
      .set(asUser("", await makeUser("slugone")))
      .send({ name: "First", slug: taken });

    expect(first.status).toBe(201);
    orgs.push(first.body.id);

    const second = await request(app)
      .post("/api/organizations")
      .set(asUser("", await makeUser("slugtwo")))
      .send({ name: "Second", slug: taken });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject(errorBody.unique);
  });

  it("refuses a slug that would not survive a path segment", async () => {
    const res = await request(app)
      .post("/api/organizations")
      .set(asUser("", await makeUser("badslug")))
      .send({ name: "Spaced Out", slug: "Not A Slug" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(errorBody.validation);
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2j — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
