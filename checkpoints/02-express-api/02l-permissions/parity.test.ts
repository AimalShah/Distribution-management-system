/**
 * Checkpoint 2l — Permissions API: Parity Test
 *
 * `requireAdmin` has no production route yet, so — exactly as the unit test does —
 * it is mounted on a route built for the purpose. The unit test proves the
 * middleware's logic against a stubbed `member.findFirst`. This one proves the
 * thing a stub cannot: that the row the middleware ends up trusting is the row the
 * schema actually holds, and that the two role vocabularies in this database do not
 * get confused for one another.
 *
 * That confusion is not hypothetical. `User.role` and `Member.role` are separate
 * columns with separate vocabularies — `User.role` is `"user" | "admin"` in the
 * seed's language, `Member.role` is `member | adminRole | owner` in the form's —
 * and the guard reads one of them. Against a stub the distinction is invisible,
 * because the stub is handed whichever role the test wants to assert about.
 */
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler } from "../../../apps/server/src/http";
import { authContext } from "../../../apps/server/src/middleware/auth-context";
import { requireAdmin } from "../../../apps/server/src/middleware/permissions";
import { getMemberRole } from "../../../apps/server/src/services/permissions";
import {
  asUser,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  skipReason,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

/**
 * `express` is a dependency of the server workspace, and pnpm keeps it there
 * rather than hoisting it to the repository root, so a bare
 * `import express from "express"` in a file under `checkpoints/` does not
 * resolve. The server's own tests never notice, because they run with the server
 * package as their root. Anchoring the resolution inside the server package gives
 * this file the same dependency — the alternative would be adding a root-level
 * `express` purely so a checkpoint test could import it, or moving the suite out
 * of `checkpoints/` and out of the parity runner.
 */
const serverRequire = createRequire(
  new URL("../../../apps/server/package.json", import.meta.url)
);
const express = serverRequire("express");
type TestApp = ReturnType<typeof express>;

describe.skipIf(!hasDatabase)("Checkpoint 2l — Permissions API", () => {
  let t: Tenant;
  const madeUsers: string[] = [];
  const madeMembers: string[] = [];

  beforeAll(async () => {
    t = await seedTenants();
  });

  afterAll(async () => {
    if (madeMembers.length) {
      await prisma.member.deleteMany({ where: { id: { in: madeMembers } } });
    }
    if (madeUsers.length) {
      await prisma.user.deleteMany({ where: { id: { in: madeUsers } } });
    }
    if (t) await teardownTenants(t);
  });

  /**
   * A user, optionally carrying a `User.role` of its own.
   *
   * The parameter exists to be set to something that disagrees with the
   * membership. Every other parity suite in this checkpoint creates users without
   * a `User.role` at all and never has to think about the column.
   */
  const makeUser = async (label: string, orgId: string, userRole?: string) => {
    const id = `usr_parity_${unique(label)}`;
    madeUsers.push(id);
    await prisma.user.create({
      data: {
        id,
        name: label,
        email: `${id}@parity.invalid`,
        emailVerified: true,
        organizationId: orgId,
        role: userRole ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return id;
  };

  const give = async (orgId: string, userId: string, role: string) => {
    const id = `mem_${unique("m")}`;
    madeMembers.push(id);
    await prisma.member.create({
      data: { id, organizationId: orgId, userId, role, createdAt: new Date() },
    });
    return id;
  };

  const buildApp = (): TestApp => {
    const app = express();
    app.get("/admin-only", authContext, requireAdmin, (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return app;
  };

  const app = buildApp();

  const call = (organizationId: string, userId: string) =>
    request(app).get("/admin-only").set(asUser(organizationId, userId));

  it("lets an owner through", async () => {
    const res = await call(t.organizationId, t.userId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("refuses an adminRole, because this guard is owner-only", async () => {
    // The distinction that the name hides. An `adminRole` is "elevated" — it may
    // add and remove members, 2k's whole subject — and it is still not an admin
    // here. The legacy `isAdmin()` asked better-auth for `project:
    // ["update", "delete"]` and of the three defined roles only `owner` holds
    // `delete`, so `isAdmin()` was true for an owner alone. `requireAdmin`
    // preserves that meaning rather than the legacy's name, which is why the two
    // guards in this checkpoint deliberately disagree about the same person.
    const admin = await makeUser("permidmin", t.organizationId);
    await give(t.organizationId, admin, "adminRole");

    const res = await call(t.organizationId, admin);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("refuses a plain member", async () => {
    const member = await makeUser("permmember", t.organizationId);
    await give(t.organizationId, member, "member");

    const res = await call(t.organizationId, member);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("refuses a caller who has no membership row at all", async () => {
    // Not "not a member of this organization" — no membership anywhere, which is
    // what a freshly invited user looks like before they accept. The guard's
    // lookup returns null and the answer has to be a refusal, not a crash and not
    // a pass.
    const nobody = await makeUser("permnobody", t.organizationId);

    expect(
      await prisma.member.count({ where: { userId: nobody } })
    ).toBe(0);

    const res = await call(t.organizationId, nobody);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("reads the membership, not the user's own role column", async () => {
    // The whole reason this suite exists. `User.role` is a real column with a real
    // vocabulary, and a guard that read it would be reading a value no
    // membership change ever updates: promoting somebody to owner in the members
    // table would leave `User.role` exactly as it was, and demoting them would not
    // take the permission away. Both directions are checked because either one on
    // its own is also consistent with a guard that reads `User.role` and ignores
    // the membership entirely.
    const disagrees = await makeUser("permdisagree", t.organizationId, "admin");
    await give(t.organizationId, disagrees, "member");

    // `User.role` says admin. The membership says member, and the membership wins.
    const refused = await call(t.organizationId, disagrees);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: "ADMIN_REQUIRED" });

    // And the mirror image: a `User.role` of "user" is no obstacle to an owner.
    const quiet = await makeUser("permquiet", t.organizationId, "user");
    await give(t.organizationId, quiet, "owner");

    const allowed = await call(t.organizationId, quiet);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ ok: true });
  });

  it("scopes the check to the organization in the header", async () => {
    // The seeded second tenant has its own owner. Being an owner of *some*
    // organization is not the question; being an owner of *this* one is. A guard
    // that asked "is this user any kind of owner anywhere" would answer 200 here
    // and hand out a route guarded for somebody else's tenant.
    const elsewhere = await call(t.organizationId, t.otherUserId);
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body).toMatchObject({ code: "ADMIN_REQUIRED" });

    // The same caller under its own organization's header is an owner, which is
    // what makes the refusal above about the tenant rather than about the person.
    const own = await call(t.otherOrganizationId, t.otherUserId);
    expect(own.status).toBe(200);
  });

  it("does not normalise the role vocabulary", async () => {
    // `Member.role` is a plain string, and the seed has historically written
    // "ADMIN" and "STAFF" into role-shaped columns. The comparisons in
    // `src/roles.ts` are exact and case-sensitive on purpose: normalising a role
    // string is how privilege gets granted by accident. A row that says "ADMIN" is
    // therefore not an owner, and a caller holding one is refused.
    const shouty = await makeUser("permshouty", t.organizationId, "ADMIN");
    await give(t.organizationId, shouty, "ADMIN");

    const res = await call(t.organizationId, shouty);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("re-reads the membership on every request", async () => {
    // No cached role, no session snapshot: a demotion has to take effect on the
    // next call, and a promotion on the one after. A guard that resolved the role
    // once per session would keep serving the first answer, and the demotion
    // below is the direction that matters.
    const mover = await makeUser("permmover", t.organizationId, "admin");
    const memberId = await give(t.organizationId, mover, "member");

    expect((await call(t.organizationId, mover)).status).toBe(403);

    await prisma.member.update({
      where: { id: memberId },
      data: { role: "owner" },
    });
    expect((await call(t.organizationId, mover)).status).toBe(200);

    await prisma.member.update({
      where: { id: memberId },
      data: { role: "member" },
    });
    const afterDemotion = await call(t.organizationId, mover);
    expect(afterDemotion.status).toBe(403);
    expect(afterDemotion.body).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("fails closed when there is no context to check", async () => {
    // The one assertion here that needs no database, kept because it is the
    // property most worth pinning: a guard that treats missing context as "no
    // restriction" is a guard that can be switched off by omitting a header.
    const res = await request(app).get("/admin-only");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "ORGANIZATION_REQUIRED" });
  });

  it("reports the membership's role verbatim, and nothing for a non-member", async () => {
    // `getMemberRole` is the other half of this module and 2k's member service
    // depends on it: "what can this person do" and "is this person an admin" are
    // different questions, and conflating them is how an `adminRole` ends up
    // locked out of adding members.
    //
    // It returns the column's own string rather than a normalised role, which is
    // what lets the member service compare against `MEMBER_ROLES` exactly. A
    // non-member is `null`, not an error and not a default role — a default would
    // be a third answer the callers do not handle.
    const noisy = await makeUser("permnoisy", t.organizationId, "admin");
    await give(t.organizationId, noisy, "adminRole");
    await give(t.otherOrganizationId, noisy, "owner");

    expect(await getMemberRole(noisy, t.organizationId)).toBe("adminRole");
    expect(await getMemberRole(noisy, t.otherOrganizationId)).toBe("owner");

    const stranger = await makeUser("permstranger", t.organizationId);
    expect(await getMemberRole(stranger, t.organizationId)).toBeNull();
    expect(await getMemberRole(t.otherUserId, t.organizationId)).toBeNull();
  });
});
