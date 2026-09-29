import prisma from "@dms/db";
import { isOwner } from "../roles";

/**
 * A boolean, which is what the name promises and what the legacy did not
 * deliver.
 *
 * `isAdmin()` in src/actions/permissions.ts and src/services/permissions.ts both
 * returned an *object* — `{ success, message }` — despite being consumed as a
 * boolean, and every one of its three call sites compared the object rather than
 * `.success`. An object is always truthy, so `if (!admin)` was always false and
 * none of them ever denied anything. In src/services/member.ts the mistake was
 * one level worse and tested the un-awaited function object, `if (!isAdmin)`.
 *
 * That is the whole legacy permission system, and it is inert. It is worth
 * stating plainly because the next checkpoint after this one replaces it, and
 * "the guard was in place and working" is the assumption a reviewer would
 * otherwise carry forward.
 */
export async function isAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });

  return membership !== null && isOwner(membership.role);
}

/**
 * The caller's role in the organization in question, or `null` for a non-member.
 *
 * Separate from `isAdmin` because "what can this person do" and "is this person
 * an admin" are different questions, and the member service in 2k needs the
 * former: it lets an `adminRole` add and remove members, which `isAdmin` answers
 * `false` for, correctly and for a reason.
 */
export async function getMemberRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const membership = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });

  return membership?.role ?? null;
}
