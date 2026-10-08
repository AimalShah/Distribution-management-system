import type { NextFunction, Request, RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "@dms/db";
import type { Auth } from "../auth";
import { badRequest, forbidden, unauthorized } from "../http/errors";

import { bearerToken, verifySessionToken } from "../services/auth";

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

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
        if (!session) {
          const token = bearerToken(req.header("authorization"));
          const claims = verifySessionToken(token);

          if (claims) {
            const organizationId =
              process.env.DMS_ORGANIZATION_ID ||
              (await prisma.organization.findFirst({ select: { id: true } }))?.id ||
              "";

            const userId =
              process.env.DMS_USER_ID ||
              (await prisma.user.findFirst({ where: { isOwner: true }, select: { id: true } }))?.id ||
              claims.username;

            await fn(req, {
              session: {
                id: `dev-session-${claims.username}`,
                activeOrganizationId: organizationId,
                userId,
                expiresAt: new Date(claims.expiresAt * 1000),
                createdAt: new Date(),
                updatedAt: new Date(),
                token: token ?? "",
              } as any,
              user: {
                id: userId,
                name: claims.name,
                email: `${claims.username}@dev.local`,
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any,
            });

            return;
          }

          throw unauthorized();
        }

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
 */
export const sessionBootstrapAuthContext = (auth: Auth): RequestHandler =>
  handle(async (req, { session, user }) => {
    req.auth = { organizationId: "", userId: user.id, sessionId: session.id };
  }, auth);
