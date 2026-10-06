import type { RequestHandler } from "express";
import type { PermissionResource } from "@dms/shared";
import { badRequest, forbidden } from "../http/errors";
import { checkPermission } from "../services/rbac";

export function requirePermission(
  resource: PermissionResource,
  action: string
): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      const organizationId = req.auth?.organizationId;
      if (!organizationId) {
        throw badRequest("Missing organization context", "ORGANIZATION_REQUIRED");
      }

      const userId = req.auth?.userId;
      if (!userId) {
        throw badRequest("Missing user context", "USER_REQUIRED");
      }

      const allowed = await checkPermission(userId, organizationId, resource, action);
      if (!allowed) {
        throw forbidden(
          `Permission denied: requires ${resource}:${action}`,
          "PERMISSION_DENIED"
        );
      }

      next();
    })().catch(next);
  };
}
