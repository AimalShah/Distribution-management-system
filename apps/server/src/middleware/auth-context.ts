import type { RequestHandler } from "express";
import { badRequest } from "../http/errors";

export const ORGANIZATION_HEADER = "x-organization-id";
export const ORGANIZATION_ENV_VAR = "DMS_ORGANIZATION_ID";
export const USER_HEADER = "x-user-id";
export const USER_ENV_VAR = "DMS_USER_ID";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: { organizationId: string; userId?: string };
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
  };
  next();
};
