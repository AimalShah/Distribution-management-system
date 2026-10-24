import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../http/async-handler";
import { listAuditLogs } from "../services/audit";

export const auditRouter: Router = Router();

const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth?.organizationId;

    if (!organizationId) {
      res.status(400).json({ error: "Organization required", code: "ORGANIZATION_REQUIRED" });

      return;
    }

    const query = auditQuerySchema.parse(req.query);

    const result = await listAuditLogs(organizationId, {
      entityType: query.entityType,
      entityId: query.entityId,
      limit: query.limit,
      offset: query.offset,
    });

    res.json(result);
  })
);
