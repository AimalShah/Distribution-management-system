import { Router } from "express";
import { asyncHandler } from "../http";
import { getCreditOverview } from "../services/credit";

export const creditRouter: Router = Router();

/**
 * Strict-mount only: the overview always answers for the active tenant.
 */
creditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getCreditOverview(req.auth.organizationId));
  })
);
