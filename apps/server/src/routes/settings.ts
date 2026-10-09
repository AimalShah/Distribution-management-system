import { Router } from "express";
import { companySettingsUpdateSchema } from "@dms/shared";
import { asyncHandler } from "../http";
import { getCompanySettings, updateCompanySettings } from "../services/settings";

export const settingsRouter: Router = Router();

/**
 * The active Company's settings. Mounted behind the strict tenant middleware, so
 * a request without an active Company is refused before it reaches here; the
 * organization is read from the auth context and never from the body.
 */
settingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getCompanySettings(req.auth.organizationId));
  })
);

settingsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const data = companySettingsUpdateSchema.parse(req.body);

    res.json(await updateCompanySettings(req.auth.organizationId, data));
  })
);
