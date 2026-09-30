import type { RequestHandler } from "express";
import { badRequest, forbidden } from "../http/errors";
import { USER_HEADER } from "./auth-context";
import { isAdmin } from "../services/permissions";

/**
 * The plan's sketch read `if (!req.auth?.isAdmin)`. There is no such field, and
 * there should not be: `authContext` fills `req.auth` from headers the client
 * chose, so an `isAdmin` flag carried on it would be a flag the client wrote.
 * The role has to come from the caller's own `Member` row.
 *
 * The organization is read from `req.auth.organizationId`, so this expects to be
 * mounted behind the strict `authContext` — a route that names its organization
 * in the path has no business here, because there would be no tenant header to
 * read and the check would silently be about the wrong organization. 2k's member
 * routes are that case, which is why they check in the service instead.
 *
 * `isAdmin` preserves the legacy's meaning rather than the legacy's name: owner
 * only. See `src/roles.ts` for why that is not the same question as "elevated".
 *
 * No route uses this yet — see the note in the checkpoint's plan.md. It exists as
 * the guard the rest of the API will adopt, and it is tested against a
 * purpose-built route so that "the middleware works" is a claim with evidence
 * behind it rather than an export nobody has ever called.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  // Express 4 does not catch a rejected promise from an async handler, so this
  // cannot be `async (req, res, next) => { ... throw }`: the rejection would be
  // an unhandled promise and the request would hang until the client gave up.
  // Every path out of here has to reach `next`, including the failure.
  void (async () => {
    const organizationId = req.auth?.organizationId;

    if (!organizationId) {
      // Fail closed. A guard that treats "no context" as "no restriction" is a
      // guard that can be switched off by omitting a header.
      throw badRequest(
        "Missing organization context",
        "ORGANIZATION_REQUIRED"
      );
    }

    const userId = req.auth?.userId;

    if (!userId) {
      throw badRequest(
        `Missing user context. Send the ${USER_HEADER} header.`,
        "USER_REQUIRED"
      );
    }

    if (!(await isAdmin(userId, organizationId))) {
      throw forbidden("Admin access required", "ADMIN_REQUIRED");
    }

    next();
  })().catch(next);
};
