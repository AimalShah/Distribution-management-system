import { Router } from "express";
import { asyncHandler } from "../http";
import { getDashboardStats } from "../services/dashboard";

export const dashboardRouter: Router = Router();

dashboardRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    res.json(await getDashboardStats(req.auth.organizationId));
  })
);
