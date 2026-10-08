/**
 * Checkpoint 2k — Member API: Parity Test
 *
 * Scope: the member roster, and the four ways this service takes the tenant from
 * somewhere the client cannot contradict.
 *
 * **1. The by-id routes read the organization off the member row.** `/api/members/:id`
 * and `/api/members/:id/role` are mounted behind `bootstrapAuthContext`, not the
 * strict `authContext`, and deliberately so: the organization comes from the row
 * being acted on, which is stronger than anything a header can assert. Requiring a
 * header as well would add a second source of tenant truth that can contradict the
 * first. The legacy `removeMember` deleted by bare member id with no organization
 * and no user in the `where` -- a cross-tenant delete -- and the fix is not a check
 * that could be forgotten but a composite `where` in the statement the database
 * executes. The delete is scoped twice, in the guard and in the SQL.
 *
 * **2. `listAvailableUsers` no longer publishes the user table.** The legacy query
 * was `prisma.user.findMany({ where: { id: { notIn: memberUserIds } } })`, which had
 * nothing to do with `organizationId`: it excluded the members of *this* tenant and
 * then returned every other user on the install, in a dropdown labelled "add
 * someone to your organization". So the test is not "does the list contain the
 * candidate" -- it is whether another tenant's user, who is not a member either, is
 * absent. The scope is `User.organizationId`, the user's *active* organization
 * rather than a membership, which the service documents as a heuristic; that it is a
 * different column from the membership is exactly what makes it worth pinning.
 *
 * **3. Ownership is a separate question from "may manage members".** `adminRole`
 * admits adding and removing, and is the wrong guard for the `owner` role, because
 * nothing in it compares the caller against the role being handed out. Both routes
 * that can write `role` reach `owner` that way. So an admin could mint a second
 * owner and then demote the legitimate one, leaving a tenant nobody can reverse --
 * every route that could add an owner back is itself behind an elevated guard. An
 * admin can still add and remove plain members; only ownership is locked down.
 *
 * **4. The last owner, counted in the transaction that acts on it.** The database
 * does not prevent a tenant deleting its own way out of existence:
 * `Member.organizationId` is a plain foreign key and the last row is a perfectly
 * valid one. The count is the only place it can be caught, and the count and the
 * delete have to be one transaction's worth of work -- run as two statements, which
 * is what they were, two owners removing each other at the same moment both read a
 * count of two and both commit, leaving zero owners. `Serializable` makes the second
 * one fail on a snapshot the first invalidated.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  asOrg,
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

describe.skipIf(!hasDatabase)("Checkpoint 2k — Member API", () => {
  let t: Tenant;
  const madeUsers: string[] = [];
  const madeOrgs: string[] = [];

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (madeUsers.length) {
      await prisma.member.deleteMany({ where: { userId: { in: madeUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: madeUsers } } });
    }

    // Cascades take the memberships with the organization.
    if (madeOrgs.length) await prisma.organization.deleteMany({ where: { id: { in: madeOrgs } } });

    if (t) await teardownTenants(t);
  });

  /**
   * A user whose *active* organization is `orgId`, which is the column
   * `listAvailableUsers` scopes on.
   */
  const makeUser = async (label: string, orgId: string) => {
    const id = `usr_parity_${unique(label)}`;
    madeUsers.push(id);
    await prisma.user.create({
      data: {
        id,
        name: label,
        email: `${id}@parity.invalid`,
        emailVerified: true,
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return id;
  };

  /** Give `userId` a membership of `orgId` at `role`, outside the API. */
  const give = async (orgId: string, userId: string, role: string) => {
    const id = `mem_${unique("m")}`;
    await prisma.member.create({
      data: { id, organizationId: orgId, userId, role, createdAt: new Date() },
    });

    return id;
  };

  /**
   * A fresh organization whose only member is `ownerId`, as an owner.
   *
   * The seeded tenant already has an owner, so a "last owner" test run against it
   * is never actually testing the last owner. Every ownership test gets its own
   * organization and therefore its own owner count.
   */
  const makeOrg = async (label: string, ownerId: string) => {
    const id = `org_parity_${unique(label)}`;
    madeOrgs.push(id);
    const at = new Date();
    await prisma.organization.create({
      data: {
        id,
        name: `${label} Ltd`,
        slug: id,
        createdAt: at,
        members: {
          create: {
            id: `mem_${unique("m")}`,
            userId: ownerId,
            role: "owner",
            createdAt: at,
          },
        },
      },
    });

    return id;
  };

  const add = (orgId: string, body: Record<string, unknown>, caller: string | null = t.userId) => {
    const req = request(app).post(`/api/organizations/${orgId}/members`).send(body);

    return caller ? req.set(asUser("", caller)) : req.set(asOrg(""));
  };

  const remove = (memberId: string, caller: string | null = t.userId) => {
    const req = request(app).delete(`/api/members/${memberId}`);

    return caller ? req.set(asUser("", caller)) : req.set(asOrg(""));
  };

  const setRole = (memberId: string, role: string, caller: string | null = t.userId) => {
    const req = request(app).patch(`/api/members/${memberId}/role`).send({ role });

    return caller ? req.set(asUser("", caller)) : req.set(asOrg(""));
  };

  const listMembers = (orgId: string, caller: string | null = t.userId) => {
    const req = request(app).get(`/api/organizations/${orgId}/members`);

    return caller ? req.set(asUser("", caller)) : req.set(asOrg(""));
  };

  const listAvailable = (orgId: string, caller: string | null = t.userId) => {
    const req = request(app).get(`/api/organizations/${orgId}/available-users`);

    return caller ? req.set(asUser("", caller)) : req.set(asOrg(""));
  };

  it("keeps another tenant's user out of the candidates", async () => {
    // The legacy second query had nothing to do with `organizationId`, so it
    // answered with every other user on the install -- including this one, who is
    // not a member either -- in a dropdown labelled "add someone to your
    // organization".
    const alreadyIn = await makeUser("already-in", t.organizationId);
    await give(t.organizationId, alreadyIn, "member");
    const fresh = await makeUser("fresh-one", t.organizationId);
    const theirs = await makeUser("candidate-theirs", t.otherOrganizationId);

    const res = await listAvailable(t.organizationId);

    expect(res.status).toBe(200);
    const ids = res.body.map((u: { id: string }) => u.id);
    // A user who is already a member is not a candidate.
    expect(ids).not.toContain(alreadyIn);
    // Another tenant's user is not a candidate either, active org or not.
    expect(ids).not.toContain(theirs);
    expect(ids).not.toContain(t.otherUserId);
    // The candidate that is left is this tenant's own, and the columns are the four
    // a row renders rather than whole `User` rows.
    expect(ids).toContain(fresh);
    expect(Object.keys(res.body[0]).sort()).toEqual(["email", "id", "image", "name"]);
  });

  it("offers a user of this tenant who is not yet a member", async () => {
    const candidate = await makeUser("fresh2", t.organizationId);

    const res = await listAvailable(t.organizationId);

    expect(res.body.map((u: { id: string }) => u.id)).toContain(candidate);
  });

  it("403s both reads for a caller who is not a member", async () => {
    // Both reads used to resolve the caller and throw the result away, which left
    // the route answering with a tenant's `user.email` rows to anyone who could
    // name the organization's id.
    const stranger = await makeUser("stranger", t.otherOrganizationId);

    for (const call of [listMembers, listAvailable]) {
      const res = await call(t.organizationId, stranger);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
    }
  });

  it("returns the roster to a plain member, with no moderation columns", async () => {
    // The legacy `getUsers` returned whole `User` rows, which carry `banned`,
    // `banReason`, `banExpires`, `isOwner`, `role` and `isFormComplete` -- internal
    // state a member table has no use for and no business displaying.
    //
    // `userId` is not among the returned columns either; the person is identified
    // by the nested `user.id`.
    const plain = await makeUser("plain", t.organizationId);
    await give(t.organizationId, plain, "member");

    const res = await listMembers(t.organizationId, plain);

    expect(res.status).toBe(200);
    const row = res.body.find((m: { user: { id: string } }) => m.user.id === plain);
    expect(row).toBeDefined();
    expect(Object.keys(row.user).sort()).toEqual(["email", "id", "image", "name"]);
    expect(row.user).not.toHaveProperty("banned");
    expect(row.user).not.toHaveProperty("isFormComplete");
  });

  it("scopes the roster to the organization in the path", async () => {
    const res = await listMembers(t.organizationId);

    expect(res.status).toBe(200);

    // The roster is exactly this organization's membership rows, so the strongest
    // available check is against the table itself.
    const expected = await prisma.member.findMany({
      where: { organizationId: t.organizationId },
      select: { id: true, userId: true },
    });

    expect(res.body.map((m: { id: string }) => m.id).sort()).toEqual(
      expected.map((m) => m.id).sort()
    );
    expect(res.body.map((m: { user: { id: string } }) => m.user.id)).not.toContain(
      t.otherUserId
    );
  });

  it("adds a member, and refuses the same user twice", async () => {
    const candidate = await makeUser("toadd", t.organizationId);

    const first = await add(t.organizationId, { userId: candidate });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ userId: candidate, role: "member" });

    // `Member` carries `@@unique([organizationId, userId])`, so the read-then-create
    // check is an early error with a message a caller can act on rather than the
    // thing that keeps the data correct.
    const second = await add(t.organizationId, { userId: candidate });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ code: "ALREADY_A_MEMBER" });
    expect(
      await prisma.member.count({ where: { organizationId: t.organizationId, userId: candidate } })
    ).toBe(1);
  });

  it("lets two concurrent adds of one user settle at one membership", async () => {
    // The read-then-create pair cannot hold under concurrency: both requests see no
    // existing row and both attempt the insert. The unique index is what actually
    // decides, and the loser comes back as P2002 -- the same 409, from the
    // constraint that holds.
    const candidate = await makeUser("racer", t.organizationId);

    const [a, b] = await Promise.all([
      add(t.organizationId, { userId: candidate }),
      add(t.organizationId, { userId: candidate }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(["ALREADY_A_MEMBER", "UNIQUE_CONSTRAINT"]).toContain(loser.body.code);
    expect(
      await prisma.member.count({ where: { organizationId: t.organizationId, userId: candidate } })
    ).toBe(1);
  });

  it("404s adding a user that does not exist", async () => {
    const res = await add(t.organizationId, { userId: `usr_parity_${unique("nobody")}` });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("403s a plain member adding anybody", async () => {
    // The legacy `addMember` was a bare `auth.api.addMember` call, whose only
    // authorisation was whatever better-auth's plugin decided. There is no such
    // plugin here.
    const plain = await makeUser("plainadder", t.organizationId);
    await give(t.organizationId, plain, "member");
    const candidate = await makeUser("target", t.organizationId);

    const res = await add(t.organizationId, { userId: candidate }, plain);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(
      await prisma.member.count({ where: { organizationId: t.organizationId, userId: candidate } })
    ).toBe(0);
  });

  it("403s a plain member adding itself to another organization", async () => {
    const res = await add(t.organizationId, { userId: t.userId }, t.otherUserId);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
  });

  it("stops an admin minting an owner", async () => {
    // `requireElevatedMember` admits `adminRole`, which is right for adding and
    // removing members and the wrong guard for the `owner` role: nothing in it
    // compares the caller against the role being handed out.
    const admin = await makeUser("admin", t.organizationId);
    await give(t.organizationId, admin, "adminRole");
    const candidate = await makeUser("wouldbe", t.organizationId);

    const res = await add(t.organizationId, { userId: candidate, role: "owner" }, admin);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "OWNER_REQUIRED_FOR_OWNERSHIP" });
    expect(await prisma.member.count({ where: { userId: candidate } })).toBe(0);
  });

  it("still lets an admin add and remove a plain member", async () => {
    // "An admin may add and remove members" is a real and useful permission. It is
    // only ownership that has to stay with the people who were already there.
    const admin = await makeUser("admin2", t.organizationId);
    const adminMemberId = await give(t.organizationId, admin, "adminRole");
    const candidate = await makeUser("byadmin", t.organizationId);

    const added = await add(t.organizationId, { userId: candidate }, admin);
    expect(added.status).toBe(201);

    const removed = await remove(added.body.id, admin);
    expect(removed.status).toBe(204);
    expect(
      await prisma.member.count({ where: { id: added.body.id } })
    ).toBe(0);
    expect(
      await prisma.member.count({ where: { id: adminMemberId } })
    ).toBe(1);
  });

  it("refuses to remove the last owner", async () => {
    // A tenant with exactly one owner can delete its own way out of existence:
    // afterwards nobody holds an elevated role, so nobody can add anyone back. The
    // database does not prevent it -- the last row is a perfectly valid one.
    const owner = await makeUser("solo", t.organizationId);
    const orgId = await makeOrg("solo-org", owner);

    const ownerMemberId = (await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
      })).id;

    const res = await remove(ownerMemberId, owner);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "LAST_OWNER" });
    expect(await prisma.member.count({ where: { id: ownerMemberId } })).toBe(1);
  });

  it("refuses to demote the last owner", async () => {
    // A demotion can empty the owner set just as a removal can.
    const owner = await makeUser("solodemote", t.organizationId);
    const orgId = await makeOrg("demote-org", owner);

    const ownerMemberId = (await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
      })).id;

    const res = await setRole(ownerMemberId, "member", owner);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "LAST_OWNER" });
    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: ownerMemberId } })).role
    ).toBe("owner");
  });

  it("lets a second owner be removed while another remains", async () => {
    const staying = await makeUser("staying", t.organizationId);
    const orgId = await makeOrg("two-org", staying);

    const stayingId = (await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
    })).id;

    const leaving = await makeUser("leaving", t.organizationId);
    const leavingId = await give(orgId, leaving, "owner");

    const removed = await remove(leavingId, staying);

    expect(removed.status).toBe(204);
    expect(await prisma.member.count({ where: { id: leavingId } })).toBe(0);
    // And the owner who stayed is still an owner, so the tenant is still manageable.
    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: stayingId } })).role
    ).toBe("owner");
  });

  it("lets a second owner be demoted while another remains", async () => {
    // The guard is about the size of the owner set, not about the role change being
    // a role change. With a second owner in place there is somebody left to add an
    // owner back, so the demotion is allowed.
    const staying = await makeUser("staying2", t.organizationId);
    const orgId = await makeOrg("demote-two-org", staying);
    const leaving = await makeUser("demoted", t.organizationId);
    const leavingId = await give(orgId, leaving, "owner");

    const res = await setRole(leavingId, "adminRole", staying);

    expect(res.status).toBe(200);
    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: leavingId } })).role
    ).toBe("adminRole");
    expect(
      await prisma.member.count({ where: { organizationId: orgId, role: "owner" } })
    ).toBe(1);
  });

  it("leaves an owner when two owners remove each other at once", async () => {
    // The last-owner count and the delete have to be one transaction's worth of
    // work. As two independent statements -- which is what they were -- both read a
    // count of two, both pass, and both commit, leaving an organization nobody can
    // manage through the API again.
    const first = await makeUser("pair1", t.organizationId);
    const orgId = await makeOrg("pair-org", first);

    const firstId = (await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId },
      select: { id: true },
      })).id;

    const second = await makeUser("pair2", t.organizationId);
    const secondId = await give(orgId, second, "owner");

    const [a, b] = await Promise.all([
      remove(secondId, first),
      remove(firstId, second),
    ]);

    const statuses = [a.status, b.status].sort();
    // One removal commits and the other is refused: LAST_OWNER from the re-read
    // count, or a write conflict from the aborted transaction. Both are 409 and
    // both are correct; what matters is the outcome.
    expect(statuses[0]).toBe(204);
    expect(statuses[1]).toBe(409);
    expect(["LAST_OWNER", "WRITE_CONFLICT"]).toContain(
      (a.status === 409 ? a : b).body.code
    );

    expect(
      await prisma.member.count({ where: { organizationId: orgId, role: "owner" } })
    ).toBe(1);
  });

  it("403s an admin removing or demoting an owner", async () => {
    // An admin that could demote an owner could strip the tenant of every owner
    // without ever minting one for itself.
    const admin = await makeUser("admin3", t.organizationId);
    const orgId = await makeOrg("guarded-org", admin);
    // Promote the admin so the guard under test is ownership, not elevation.
    await prisma.member.updateMany({
      where: { organizationId: orgId, userId: admin },
      data: { role: "adminRole" },
    });
    const owner = await makeUser("protected", t.organizationId);
    const ownerId = await give(orgId, owner, "owner");

    const removed = await remove(ownerId, admin);
    expect(removed.status).toBe(403);
    expect(removed.body).toMatchObject({ code: "OWNER_REQUIRED_FOR_OWNERSHIP" });

    const demoted = await setRole(ownerId, "member", admin);
    expect(demoted.status).toBe(403);
    expect(demoted.body).toMatchObject({ code: "OWNER_REQUIRED_FOR_OWNERSHIP" });

    expect((await prisma.member.findUniqueOrThrow({ where: { id: ownerId } })).role).toBe("owner");
  });

  it("keeps the delete scoped to the member's own organization", async () => {
    // The legacy deleted by bare member id with no organization and no user in the
    // `where`, which on its own is a cross-tenant delete. A caller who is an owner
    // of their own organization naming a member of another one is refused, and the
    // member survives.
    const mineOwner = await makeUser("mineowner", t.organizationId);
    await give(t.organizationId, mineOwner, "owner");

    const theirUser = await makeUser("theiruser", t.otherOrganizationId);
    const theirMember = await give(t.otherOrganizationId, theirUser, "member");

    const res = await remove(theirMember, mineOwner);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "NOT_A_MEMBER" });
    expect(await prisma.member.count({ where: { id: theirMember } })).toBe(1);
  });

  it("takes the tenant from the member row, so no organization header is needed", async () => {
    // The by-id routes sit behind `bootstrapAuthContext` deliberately. The row's own
    // `organizationId` is the tenant; a second header could only contradict it.
    const target = await makeUser("headerless", t.organizationId);
    const memberId = await give(t.organizationId, target, "member");

    const res = await request(app).delete(`/api/members/${memberId}`).set({ "x-user-id": t.userId });

    expect(res.status).toBe(204);
    expect(await prisma.member.count({ where: { id: memberId } })).toBe(0);
  });

  it("404s an unknown member id on all three by-id routes", async () => {
    const ghost = `mem_${unique("gone")}`;

    for (const call of [
      () => remove(ghost),
      () => setRole(ghost, "member"),
    ]) {
      const res = await call();
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: "MEMBER_NOT_FOUND" });
    }
  });

  it("requires a user header on every member route", async () => {
    const candidate = await makeUser("nohdr", t.organizationId);
    const memberId = await give(t.organizationId, candidate, "member");

    const calls: [string, () => Promise<{ status: number }>][] = [
      [`/api/organizations/${t.organizationId}/members`, () => request(app).get(`/api/organizations/${t.organizationId}/members`)],
      [`/api/organizations/${t.organizationId}/available-users`, () => request(app).get(`/api/organizations/${t.organizationId}/available-users`)],
      ["add", () => request(app).post(`/api/organizations/${t.organizationId}/members`).send({ userId: candidate })],
      ["remove", () => request(app).delete(`/api/members/${memberId}`)],
      ["role", () => request(app).patch(`/api/members/${memberId}/role`).send({ role: "member" })],
    ];

    for (const [label, call] of calls) {
      const res = await call();
      expect(res.status, label).toBe(400);
      expect(res.body).toMatchObject({ code: "USER_REQUIRED" });
    }

    // Nothing was written.
    expect(await prisma.member.count({ where: { id: memberId } })).toBe(1);
  });

  it("refuses a role outside the three the column knows", async () => {
    const candidate = await makeUser("badrole", t.organizationId);
    const memberId = await give(t.organizationId, candidate, "member");

    const added = await add(t.organizationId, { userId: candidate, role: "superuser" });
    expect(added.status).toBe(400);
    expect(added.body).toMatchObject(errorBody.validation);

    const patched = await setRole(memberId, "superuser");
    expect(patched.status).toBe(400);
    expect(patched.body).toMatchObject(errorBody.validation);
    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).role
    ).toBe("member");
  });

  it("defaults an omitted role to member", async () => {
    const candidate = await makeUser("defaultrole", t.organizationId);

    const res = await add(t.organizationId, { userId: candidate });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("member");
  });
});

if (!hasDatabase) {
  describe("Checkpoint 2k — database", () => {
    it(`skipped: ${skipReason}`, () => expect(hasDatabase).toBe(false));
  });
}
