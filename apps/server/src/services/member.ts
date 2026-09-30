import prisma from "@dms/db";
import type {
  AddMemberInput,
  MemberRole,
  UpdateMemberRoleInput,
} from "@dms/shared";
import { conflict, forbidden, notFound } from "../http";

/**
 * Roles that may change an organization's membership. "owner" and "adminRole"
 * are the two elevated names in the `memRole` set the legacy form submitted.
 * Case-sensitive and exact on purpose -- a row saying "ADMIN" is not elevated.
 */
const ELEVATED_ROLES: readonly string[] = ["owner", "adminRole"];

const isElevated = (role: string) => ELEVATED_ROLES.includes(role);

/**
 * The transaction-scoped client `prisma.$transaction` hands to its callback.
 * `Prisma.TransactionClient` is the bare client's version of this and is not
 * interchangeable here -- the shared client is extended with a query logger, so
 * an interactive transaction hands back the extended shape. Same reason, same
 * shape, as `TransactionTx` in `services/return.ts`.
 */
type TransactionTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Counts owner rows for the organization, counted *inside* whichever transaction
 * the caller is already in. It takes a client rather than reaching for the module
 * singleton, because the count and the write it guards have to share one
 * transaction: see `removeMember`.
 */
const isOwner = (role: string) => role === "owner";

const countOwners = (tx: TransactionTx, organizationId: string) =>
  tx.member.count({ where: { organizationId, role: "owner" } });

export async function findMembership(userId: string, organizationId: string) {
  return prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true, userId: true, organizationId: true, role: true },
  });
}

/**
 * Read-tier guard: the caller only has to be *a* member of the organization in
 * question.
 *
 * Every route in this file acts on an organization's membership, and an
 * authenticated caller who is not a member of it has no business reading its
 * roster or its candidate list. Both reads used to resolve the caller and throw
 * the result away, which left the route answering with a tenant's `user.email`
 * rows to anyone who could name the organization's id. Checkpoint 3 replaces the
 * stand-in middleware and makes `req.auth.userId` trustworthy; it does not add an
 * authorization step that is not here.
 */
async function requireMember(userId: string, organizationId: string) {
  const membership = await findMembership(userId, organizationId);

  if (!membership) {
    // 403 rather than 404, matching `requireElevatedMember`: the organization may
    // well exist, the caller simply is not in it, and that is the useful thing to
    // tell them.
    throw forbidden(
      "You are not a member of this organization",
      "NOT_A_MEMBER"
    );
  }

  return membership;
}

/**
 * An ownership grant is a separate question from "may manage members".
 *
 * `requireElevatedMember` admits `adminRole`, which is right for adding and
 * removing members. It is the wrong guard for the `owner` role itself, because
 * nothing in it compares the caller against the role being handed out. Both of
 * the routes that can write `role` reach `owner` that way:
 *
 *   - `addMember` takes `role` straight from the body, and `memberRoleSchema`
 *     includes `owner`.
 *   - `updateMemberRole` takes `role` from the body, and the last-owner guard
 *     only fires when the *target* is currently an owner -- so an `adminRole`
 *     promoting themselves is not caught by it.
 *
 * So an `adminRole` could mint a second owner and then demote or remove the
 * legitimate one, leaving a tenant taken over by someone the owner never chose,
 * with nobody left who can reverse it: every route that could add an owner back
 * is itself behind an elevated guard.
 *
 * Only an `owner` grants or revokes ownership. `adminRole` keeps everything else
 * it already had, because "an admin may add and remove members" is a real and
 * useful permission -- it is only ownership that has to stay with the people who
 * were already there.
 *
 * Revoking counts as much as granting. An `adminRole` that could demote an owner
 * could strip the tenant of every owner without ever minting one for itself, and
 * a tenant with no owner is a tenant nobody can add an owner back to, because
 * every route that could is behind this same guard.
 */
async function requireOwnerForRoleChange(
  callerMembership: { role: string },
  currentRole: string,
  nextRole: string
) {
  if (
    (currentRole === "owner" || nextRole === "owner") &&
    !isOwner(callerMembership.role)
  ) {
    throw forbidden(
      "Only an owner can grant or revoke ownership",
      "OWNER_REQUIRED_FOR_OWNERSHIP"
    );
  }
}

/**
 * The caller has to be an owner or admin of the organization in question.
 *
 * The legacy had two attempts at this and neither worked. `removeMember` in
 * src/services/member.ts was:
 *
 *   const admin = await isAdmin()
 *   if (!isAdmin) { return { success: false, ... } }
 *
 * It tested `isAdmin` -- the function object -- instead of the awaited `admin`.
 * A function is always truthy, so `!isAdmin` was always `false` and the guard
 * never fired. The awaited result was computed and thrown away. The admin check
 * in src/actions/members.ts was the same shape, so `removeMember` there had no
 * effective authorisation either.
 *
 * That is why the check lives here, called with the caller's own id and the
 * organization in question, rather than in a middleware reading a permission
 * table that does not exist yet. Full permission modelling is Checkpoint 6; this
 * is the floor.
 */
async function requireElevatedMember(userId: string, organizationId: string) {
  const membership = await findMembership(userId, organizationId);

  if (!membership) {
    // 403 rather than 404: the organization may well exist, the caller simply is
    // not in it, and that is the useful thing to tell them.
    throw forbidden(
      "You are not a member of this organization",
      "NOT_A_MEMBER"
    );
  }

  if (!isElevated(membership.role)) {
    throw forbidden(
      "Only an owner or admin can manage members of this organization",
      "INSUFFICIENT_ROLE"
    );
  }

  return membership;
}

/**
 * The member list with just enough of each user to render a row: an avatar, a
 * name, an email. The legacy `getUsers` returned whole `User` rows, which carry
 * `banned`, `banReason`, `banExpires`, `isOwner`, `role` and `isFormComplete` --
 * moderation state and internal flags that a member table has no use for and no
 * business displaying.
 */
export async function listMembers(
  organizationId: string,
  callerUserId: string
) {
  await requireMember(callerUserId, organizationId);

  return prisma.member.findMany({
    where: { organizationId },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Users available to add to this organization.
 *
 * The legacy `getUsers` was:
 *
 *   const members = await prisma.member.findMany({ where: { organizationId }, select: { userId: true } })
 *   const memberUserIds = members.map(m => m.userId)
 *   const users = await prisma.user.findMany({ where: { id: { notIn: memberUserIds } } })
 *
 * The second query has nothing to do with `organizationId`. It excluded the
 * members of *this* organization and then returned every other user on the
 * install -- every user of every other tenant, with their email addresses, in a
 * dropdown labelled "add someone to your organization". Reading it as a
 * directory of candidates to invite is the only way the call makes sense, and it
 * published the whole user table.
 *
 * Scoped here to users whose `User.organizationId` is this organization. That
 * column is the user's *active* organization rather than a membership -- one user
 * can be a member of several organizations and have only one of them here -- so
 * this is a heuristic and not a truth. It is still the only tenant signal on the
 * model, and it is the difference between a tenant's own people and everyone's.
 * A first-class "which users belong to this tenant" answer needs the membership
 * data to be authoritative, which is Checkpoint 6.
 */
export async function listAvailableUsers(
  organizationId: string,
  callerUserId: string
) {
  await requireMember(callerUserId, organizationId);

  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });

  return prisma.user.findMany({
    where: {
      organizationId,
      id: { notIn: members.map((m) => m.userId) },
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });
}

/**
 * The legacy `addMember` was a bare `auth.api.addMember` call, whose only
 * authorisation was whatever better-auth's plugin decided. There is no such
 * plugin here, so without a check this route would let any member of an
 * organization add any user on the install to it.
 */
export async function addMember(
  organizationId: string,
  data: AddMemberInput,
  callerUserId: string
) {
  const callerMembership = await requireElevatedMember(
    callerUserId,
    organizationId
  );

  await requireOwnerForRoleChange(callerMembership, "member", data.role);

  const target = await prisma.user.findFirst({
    where: { id: data.userId },
    select: { id: true },
  });

  if (!target) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const existing = await findMembership(data.userId, organizationId);

  if (existing) {
    // `Member` carries `@@unique([organizationId, userId])`, so this check is an
    // early error with a message a caller can act on rather than the thing that
    // keeps the data correct. Two concurrent requests can both find no existing
    // row and both attempt the insert; the second one loses on the index and
    // comes back as P2002, which the central mapping renders as a 409 -- the
    // same answer, from the constraint that actually holds.
    throw conflict(
      "That user is already a member of this organization",
      "ALREADY_A_MEMBER"
    );
  }

  return prisma.member.create({
    data: {
      id: crypto.randomUUID(),
      organizationId,
      userId: data.userId,
      role: data.role satisfies MemberRole,
      createdAt: new Date(),
    },
  });
}

/**
 * The legacy `removeMember` deleted by bare member id, with no organization and
 * no user in the `where`. On its own that is a cross-tenant delete; combined
 * with the `if (!isAdmin)` bug above it was reachable by any authenticated user
 * in the install for any member id they could guess or read.
 *
 * The membership is loaded first so the organisation is known, and the delete
 * repeats both `id` and `organizationId` -- Prisma's `delete` takes a unique
 * selector, so a composite `where` is the only way to keep the scoping in the
 * statement the database executes rather than in a check that could be
 * forgotten. `memberId` alone is not unique across organizations in a way the
 * client controls, and this makes the scoping part of the write.
 */
export async function removeMember(
  memberId: string,
  callerUserId: string
): Promise<{ id: string }> {
  const membership = await prisma.member.findFirst({
    where: { id: memberId },
    select: { id: true, organizationId: true, userId: true, role: true },
  });

  if (!membership) {
    throw notFound("Member not found", "MEMBER_NOT_FOUND");
  }

  const callerMembership = await requireElevatedMember(
    callerUserId,
    membership.organizationId
  );

  await requireOwnerForRoleChange(
    callerMembership,
    membership.role,
    "owner"
  );

  // A tenant with exactly one owner can delete its own way out of existence:
  // afterwards nobody holds an elevated role, so nobody can add anyone back.
  // The database does not prevent it -- `Member.organizationId` is a plain
  // foreign key and the last row is a perfectly valid one. The count is the
  // only place this can be caught.
  //
  // The count and the delete have to be one statement's worth of work, though.
  // Run as two independent statements -- which is what they were -- two owners
  // demoting or removing each other at the same moment both read a count of two,
  // both pass, and both commit, leaving zero owners and an organization nobody
  // can manage again through the API. `Serializable` makes the second transaction
  // fail rather than commit on a snapshot the first one invalidated, and the
  // retry re-reads the count and sees the truth.
  return prisma.$transaction(
    async (tx) => {
      if (membership.role === "owner" && (await countOwners(tx, membership.organizationId)) <= 1) {
        throw conflict(
          "This is the last owner of the organization. Promote another member before removing them.",
          "LAST_OWNER"
        );
      }

      return tx.member.delete({
        where: { id: memberId, organizationId: membership.organizationId },
        select: { id: true },
      });
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * Not in the 2k plan, which listed four endpoints. It is here because role is
 * the one field on a membership that an owner legitimately needs to change after
 * the fact, and the legacy had no way to do it: `Member.role` was set once by
 * `addMember` and never updated, so correcting a mislabelled member meant
 * removing and re-adding them. The same guards as the other writes, and the same
 * last-owner check, because a demotion can empty the owner set just as a removal
 * can.
 */
export async function updateMemberRole(
  memberId: string,
  data: UpdateMemberRoleInput,
  callerUserId: string
) {
  const membership = await prisma.member.findFirst({
    where: { id: memberId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!membership) {
    throw notFound("Member not found", "MEMBER_NOT_FOUND");
  }

  const callerMembership = await requireElevatedMember(
    callerUserId,
    membership.organizationId
  );

  await requireOwnerForRoleChange(
    callerMembership,
    membership.role,
    data.role
  );

  return prisma.$transaction(
    async (tx) => {
      if (
        membership.role === "owner" &&
        data.role !== "owner" &&
        (await countOwners(tx, membership.organizationId)) <= 1
      ) {
        throw conflict(
          "This is the last owner of the organization. Promote another member first.",
          "LAST_OWNER"
        );
      }

      return tx.member.update({
        where: { id: memberId, organizationId: membership.organizationId },
        data: { role: data.role },
        select: {
          id: true,
          role: true,
          organizationId: true,
          userId: true,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}
