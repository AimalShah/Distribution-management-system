import prisma from "@dms/db";
import type { AddMemberInput, MemberRole, UpdateMemberRoleInput } from "@dms/shared";
import { conflict, forbidden, notFound } from "../http";

/**
 * Roles that may change an organization's membership.
 *
 * "owner" and "adminRole" are the two elevated names in the `memRole` set the
 * legacy form submitted. "adminRole" reads like a typo for "admin", and
 * `User.role` spells it "admin" while the seed writes "ADMIN" and "STAFF" --
 * three vocabularies for one concept, none of them enforced by the schema
 * because `Member.role` is a plain `String`.
 *
 * So this comparison is case-sensitive and exact, and it will not match a row
 * that says "ADMIN". That is a real limitation and it is deliberate: guessing at
 * a role string is how privilege gets granted by accident. Checkpoint 6 rebuilds
 * RBAC and owns reconciling the vocabulary; until then a membership whose role
 * this function does not recognise simply is not treated as elevated.
 */
const ELEVATED_ROLES: readonly string[] = ["owner", "adminRole"];

const isElevated = (role: string) => ELEVATED_ROLES.includes(role);

const countOwners = (organizationId: string) =>
  prisma.member.count({ where: { organizationId, role: "owner" } });

export async function findMembership(userId: string, organizationId: string) {
  return prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true, userId: true, organizationId: true, role: true },
  });
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
export async function listMembers(organizationId: string) {
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
export async function listAvailableUsers(organizationId: string) {
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
  await requireElevatedMember(callerUserId, organizationId);

  const target = await prisma.user.findFirst({
    where: { id: data.userId },
    select: { id: true },
  });

  if (!target) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const existing = await findMembership(data.userId, organizationId);

  if (existing) {
    // `Member` has no unique index on (organizationId, userId) -- schema.prisma:113
    // carries no @@unique at all -- so a second insert succeeds and leaves two
    // rows for one user. Every membership read takes the first match, so the
    // duplicate would be invisible in the read path while the user appeared
    // twice in the list.
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

  await requireElevatedMember(callerUserId, membership.organizationId);

  // A tenant with exactly one owner can delete its own way out of existence:
  // afterwards nobody holds an elevated role, so nobody can add anyone back.
  // The database does not prevent it -- `Member.organizationId` is a plain
  // foreign key and the last row is a perfectly valid one. The count is the
  // only place this can be caught, and it is only worth asking when the row
  // being removed is an owner.
  if (membership.role === "owner" && (await countOwners(membership.organizationId)) <= 1) {
    throw conflict(
      "This is the last owner of the organization. Promote another member before removing them.",
      "LAST_OWNER"
    );
  }

  return prisma.member.delete({
    where: { id: memberId, organizationId: membership.organizationId },
    select: { id: true },
  });
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

  await requireElevatedMember(callerUserId, membership.organizationId);

  if (
    membership.role === "owner" &&
    data.role !== "owner" &&
    (await countOwners(membership.organizationId)) <= 1
  ) {
    throw conflict(
      "This is the last owner of the organization. Promote another member first.",
      "LAST_OWNER"
    );
  }

  return prisma.member.update({
    where: { id: memberId, organizationId: membership.organizationId },
    data: { role: data.role },
    select: {
      id: true,
      role: true,
      organizationId: true,
      userId: true,
    },
  });
}
