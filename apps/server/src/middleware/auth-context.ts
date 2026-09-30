import type { RequestHandler } from "express";
import { badRequest } from "../http/errors";

export const ORGANIZATION_HEADER = "x-organization-id";
export const ORGANIZATION_ENV_VAR = "DMS_ORGANIZATION_ID";
export const USER_HEADER = "x-user-id";
export const USER_ENV_VAR = "DMS_USER_ID";
export const SESSION_HEADER = "x-session-id";
export const SESSION_ENV_VAR = "DMS_SESSION_ID";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: {
        organizationId: string;
        userId?: string;
        sessionId?: string;
      };
    }
  }
}

/**
 * TEMPORARY stand-in for the session middleware built in Checkpoint 3. It
 * trusts a client supplied organization id, which is only acceptable because
 * nothing is exposed to untrusted clients yet. Checkpoint 3 replaces this file
 * with real session/role resolution and adds `userId` and the permission set;
 * every route already reads the tenant from `req.auth.organizationId`, so that
 * swap is confined to this middleware and `app.ts`.
 */
export const authContext: RequestHandler = (req, _res, next) => {
  const organizationId =
    req.header(ORGANIZATION_HEADER)?.trim() ||
    process.env[ORGANIZATION_ENV_VAR]?.trim();

  if (!organizationId) {
    next(
      badRequest(
        `Missing organization context. Send the ${ORGANIZATION_HEADER} header.`,
        "ORGANIZATION_REQUIRED"
      )
    );
    return;
  }

  // Optional: only the routes that write an audit row (`InventoryLog`) insist on
  // it, and they answer 400 USER_REQUIRED rather than writing an unattributed
  // log entry.
  req.auth = {
    organizationId,
    userId:
      req.header(USER_HEADER)?.trim() || process.env[USER_ENV_VAR]?.trim() || undefined,
    sessionId:
      req.header(SESSION_HEADER)?.trim() ||
      process.env[SESSION_ENV_VAR]?.trim() ||
      undefined,
  };
  next();
};

/**
 * The same three values, all optional, and no 400.
 *
 * The organization routes need this because they are the one place where a
 * missing active organization is the normal case rather than an error:
 * `POST /organizations` is how a user creates their *first* organization, so at
 * that moment they have no active one, and `GET /organizations` is the call
 * that tells them what they have. Requiring the tenant header on those would
 * mean the bootstrap path is the one path that cannot be bootstrapped.
 *
 * Requiring nothing is only safe because each of those routes states what it
 * needs: the ones that act on a user ask for `userId` and answer
 * 400 USER_REQUIRED, the two that read or write the active organization ask for
 * `sessionId` and answer 400 SESSION_REQUIRED, and none of them fall back to an
 * unscoped query when a value is missing.
 */
export const bootstrapAuthContext: RequestHandler = (req, _res, next) => {
  req.auth = {
    organizationId: "",
    userId: req.header(USER_HEADER)?.trim() || process.env[USER_ENV_VAR]?.trim() || undefined,
    sessionId:
      req.header(SESSION_HEADER)?.trim() ||
      process.env[SESSION_ENV_VAR]?.trim() ||
      undefined,
  };
  next();
};

/**
 * The counterpart to `bootstrapAuthContext`: behind it the two values a route
 * cannot work without are `undefined` rather than present, and a route that
 * needs one has to say so.
 *
 * These live here, next to the middleware that fills `req.auth` and to the
 * Checkpoint 3 note about replacing it, because they are the same concern read
 * the other way around. They are assertions about request context, not about
 * the request body, which is what the schemas in `@dms/shared` are for.
 */
export const requireUserId = (userId?: string): string => {
  if (!userId) {
    throw badRequest(
      `Missing user context. Send the ${USER_HEADER} header.`,
      "USER_REQUIRED"
    );
  }
  return userId;
};

export const requireSessionId = (sessionId?: string): string => {
  if (!sessionId) {
    throw badRequest(
      `Missing session context. Send the ${SESSION_HEADER} header.`,
      "SESSION_REQUIRED"
    );
  }
  return sessionId;
};

