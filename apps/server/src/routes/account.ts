import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { firstPasswordChangeSchema } from "@dms/shared";
import { asyncHandler } from "../http";
import { completeFirstPasswordChange } from "../services/user-provisioning";
import { requireUserId } from "../middleware/auth-context";
import type { Auth } from "../auth";

/**
 * P0-5: the one route a provisioned staff member can reach while every other
 * authenticated mount still refuses them with PASSWORD_CHANGE_REQUIRED.
 *
 * It replaces their temporary password -- verified by better-auth's own
 * `changePassword` under the caller's session headers, so "authorized to
 * change the password" means "holding the account's current password" -- and
 * then clears `User.mustChangePassword`, which is the flag the guard
 * middlewares read. After this answer, the very next tenant request succeeds.
 *
 * Mounted behind `sessionBootstrapOpenAuthContext` (session required, no
 * account locks); the flag the middleware refuses on would otherwise gate the
 * route that is meant to end it.
 */
export const accountRouter = (auth: Auth): Router => {
  const router: Router = Router();

  router.post(
    "/me/password",
    asyncHandler(async (req, res) => {
      const data = firstPasswordChangeSchema.parse(req.body);

      await completeFirstPasswordChange(
        auth,
        data,
        requireUserId(req.auth.userId),
        fromNodeHeaders(req.headers)
      );

      res.status(204).send();
    })
  );

  return router;
};
