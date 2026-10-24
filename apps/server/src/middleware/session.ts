import type { NextFunction, Request, RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "@dms/db";
import type { Auth } from "../auth";
import { badRequest, forbidden, unauthorized } from "../http/errors";

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/**
 * The two account-level locks P0-5 enforces, checked against the session's own
 * user on every authenticated mount:
 *
 * - `banned`: the provisioning service sets it when an owner deactivates a
 *   member and deletes that user's live sessions, so an unauthenticated caller
 *   is the normal case here. Better-auth's admin plugin independently refuses
 *   the sign-in of a banned user (BANNED_USER at session creation). This check
 *   covers the race in between: a session minted moments before the
 *   deactivation lands is refused here on its next request.
 * - `mustChangePassword`: set when an owner provisions a staff account with a
 *   temporary password, and cleared only by the first-login password-change
 *   endpoint. While it stands no tenant route is reachable at all, so a
 *   provisioned staff cannot read, write, or create an organization before
 *   replacing the password.
 */
const assertAccountUsable = (user: {
  id: string;
  banned?: boolean | null;
  mustChangePassword?: boolean | null;
}) => {
  if (user.banned) {
    throw unauthorized(
      "This account has been deactivated. Contact the owner of your organization.",
      "ACCOUNT_DEACTIVATED"
    );
  }

  if (user.mustChangePassword) {
    throw forbidden(
      "Your password must be changed before you can use the app.",
      "PASSWORD_CHANGE_REQUIRED"
    );
  }
};

/**
 * Express 4 does not catch a rejected promise from an async handler, so each
 * middleware below is written as a promise and routed to `next` explicitly.
 */
const handle =
  (fn: (req: Request, session: Session) => Promise<void>, auth: Auth): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .then(async (session) => {
        if (!session) throw unauthorized();

        await fn(req, session);
      })
      .then(() => next(), next);
  };

/**
 * The replacement for the header-trust `authContext`: the user, the session and
 * the tenant all come from a better-auth session (cookie, or `Authorization:
 * Bearer <token>`), so none of them are values the client gets to choose.
 *
 * The tenant is the session's `activeOrganizationId`, and it is re-checked
 * against `Member` on every request rather than trusted because it is on the
 * session. The session row outlives the membership: a user removed from an
 * organization keeps a session that still points at it until they switch or
 * sign out, and without this check they would keep reading that tenant's
 * invoices for as long as the session lives.
 */
export const sessionAuthContext = (auth: Auth): RequestHandler =>
  handle(async (req, { session, user }) => {
    assertAccountUsable(user);

    const organizationId = session.activeOrganizationId;

    if (!organizationId) {
      throw badRequest(
        "No active organization. Select one with POST /api/auth/organization/set-active.",
        "ORGANIZATION_REQUIRED"
      );
    }

    const membership = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      select: { id: true },
    });

    if (!membership) {
      throw forbidden(
        "You are not a member of the active organization.",
        "NOT_A_MEMBER"
      );
    }

    req.auth = { organizationId, userId: user.id, sessionId: session.id };
  }, auth);

/**
 * The session counterpart to `bootstrapAuthContext`: a signed-in user with no
 * active organization yet is the normal case on these routes, so only the
 * session is required. Each organization/member route already checks
 * membership in its service against the id it acts on.
 *
 * Both account locks above apply here too, so a provisioned staff cannot work
 * the organization routes (create an organization, list memberships) while
 * their password is still the temporary one, and a deactivated member cannot
 * act through a session they held before deactivation. The one route exempt
 * from the mustChangePassword half is the first-login password change itself,
 * which sits behind `sessionBootstrapOpenAuthContext` below.
 */
export const sessionBootstrapAuthContext = (auth: Auth): RequestHandler =>
  handle(async (req, { session, user }) => {
    assertAccountUsable(user);

    req.auth = { organizationId: "", userId: user.id, sessionId: session.id };
  }, auth);

/**
 * The same middleware without the account locks, for exactly one mount: the
 * route that clears `mustChangePassword`. Gating it with its own lock would
 * mean the route insists on the password being already changed -- the opposite
 * of its purpose -- and the deactivation half stays unnecessary because a
 * deactivated user's sessions were deleted at deactivation (and better-auth
 * refuses their sign-in outright).
 */
export const sessionBootstrapOpenAuthContext = (auth: Auth): RequestHandler =>
  handle(async (req, { session, user }) => {
    req.auth = { organizationId: "", userId: user.id, sessionId: session.id };
  }, auth);
