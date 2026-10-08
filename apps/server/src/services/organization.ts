import prisma from "@dms/db";
import type { OrganizationCreateInput } from "@dms/shared";
import { forbidden, notFound } from "../http";

async function findMembership(userId: string, organizationId: string) {
  return prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true, userId: true, organizationId: true, role: true },
  });
}

/**
 * The legacy `getActiveOrganizationService` did
 * `member.findFirst({ where: { userId } })` and then read that membership's
 * organization, so "the active organization" was whichever membership the
 * database happened to return first -- not the one the session selected, and not
 * even a stable one. Two organizations for the same user could make the
 * dashboard switch tenants between two page loads.
 *
 * Here the active organization is only ever the session's choice. When the
 * session has not chosen one there is no active organization, and that is
 * reported as such rather than filled in with an arbitrary row.
 *
 * Optional read, hence the `find` name: "the user has no active organization"
 * is a real answer the route turns into its own 404, not a missing row, so this
 * one keeps returning null.
 */
export async function findActiveOrganization(userId: string, sessionId: string) {
  const session = await prisma.session.findFirst({
    // `expiresAt` is on the model and was not in the predicate, so an expired or
    // revoked session id resolved an active organization just as a live one did.
    // Under the stand-in middleware the session id is client-chosen, so this is
    // the difference between "a session the user still holds" and "a string that
    // matches a row". Checkpoint 3 replaces the shim, not this predicate.
    where: { id: sessionId, userId, expiresAt: { gt: new Date() } },
    select: { activeOrganizationId: true },
  });

  if (!session?.activeOrganizationId) return null;

  // Scoped through the membership rather than read by bare id. The legacy
  // `getCurrentActiveOrganizationService` was `organization.findUnique({ where:
  // { id: activeOrgId } })`, so it would hand back any organization in the
  // database if the session ever pointed at one the user had since been removed
  // from.
  const membership = await findMembership(userId, session.activeOrganizationId);

  if (!membership) return null;

  return prisma.organization.findFirst({
    where: { id: membership.organizationId },
  });
}

/**
 * The legacy `getUserOrganization` was:
 *
 *   const orgs = await getUserOrganizationsService(curntUser.id)
 *   if (orgs && orgs.length > 0) return orgs
 *   const allOrgs = await prisma.organization.findMany()
 *   return allOrgs
 *
 * The fallback is unscoped. A user who was a member of nothing was answered with
 * every organization in the installation, including their names, slugs and
 * member lists, and the caller rendered that list as their own. The same shape
 * appears in `getCurrentActiveOrganization`, whose fallback is
 * `organization.findFirst()` -- the first row of the table.
 *
 * The membership filter is the whole list now, and there is no fallback. An
 * empty array means the user is in no organizations, which is a true and
 * actionable answer, and it is the state the create-organization flow exists to
 * leave.
 */
export async function getUserOrganizations(userId: string) {
  return prisma.organization.findMany({
    where: { members: { some: { userId } } },
    include: { members: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The legacy service called `auth.api.createOrganization`, which is better-auth
 * and does not exist anywhere in this monorepo yet -- it arrives with Checkpoint
 * 3. What that call actually did to the database was insert the organization
 * and insert a `Member` row for the creator with role "owner", so that is what
 * happens here, in one transaction.
 *
 * The second write the legacy did was `user.update({ organizationId, isFormComplete:
 * true })`. Kept, because the dashboard and the onboarding redirect both read
 * `isFormComplete`, and because the rest of the app resolves a tenant from
 * `User.organizationId` until the session carries one.
 *
 * `id`, `createdAt` and `updatedAt` have no default on the Organization model
 * (schema.prisma:90-96) unlike the DMS-owned models, which use `cuid()` and
 * `@default(now())`. better-auth supplied all three; direct writes have to.
 */
export async function createOrganization(
  data: OrganizationCreateInput,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        slug: data.slug,
        createdAt: new Date(),
        members: {
          create: {
            id: crypto.randomUUID(),
            userId,
            role: "owner",
            createdAt: new Date(),
          },
        },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { organizationId: organization.id, isFormComplete: true },
    });

    return organization;
  });
}

/**
 * The legacy `setActiveOrganizationService` checked the membership and then did
 * `session.update({ where: { id: sessionId } })` -- the session id alone. A
 * caller who named another user's session id could move that user's active
 * organization, and the membership check on the caller's own id would not
 * notice. The membership is proved *and* the write is scoped to the caller's
 * own session here, so the two cannot disagree.
 */
export async function setActiveOrganization(
  organizationId: string,
  userId: string,
  sessionId: string
): Promise<{ count: number }> {
  const membership = await findMembership(userId, organizationId);

  if (!membership) {
    // 403 rather than 404: the organization may well exist, the caller simply is
    // not in it, and that is the useful thing to tell them. It confirms no more
    // than "this id is not one of yours", which the caller already knows.
    throw forbidden(
      "You are not a member of this organization",
      "NOT_A_MEMBER"
    );
  }

  // `{ id, userId }` matches nothing for a session that is not the caller's, or
  // that does not exist. That scoping is the security fix above and it holds; but
  // the route answered 204 regardless of the count, so a caller naming someone
  // else's session -- or a stale one of their own -- got a success for a write
  // that touched no rows. The caller is told which of the two happened.
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { activeOrganizationId: organizationId },
  });

  if (result.count === 0) {
    throw notFound("Session not found", "SESSION_NOT_FOUND");
  }

  return result;
}

/**
 * Exported for the report checkpoints, which all need "the organizations this
 * user belongs to" as a filter set rather than a list of records. Kept as a
 * plain id list so a caller cannot accidentally render one as a name.
 */
export async function getUserOrganizationIds(userId: string) {
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  return memberships.map((m) => m.organizationId);
}
