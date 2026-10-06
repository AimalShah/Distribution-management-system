import { Router } from "express";
import { z } from "zod";
import {
  createRoleSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
} from "@dms/shared";
import { asyncHandler, badRequest } from "../http";
import {
  assignMemberRole,
  createRole,
  deleteRole,
  getRole,
  listRoles,
  updateRole,
  updateRolePermissions,
} from "../services/rbac";

export const roleRouter: Router = Router();

roleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const roles = await listRoles(orgId);
    res.json({ roles });
  })
);

roleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const input = createRoleSchema.parse(req.body);
    const role = await createRole(orgId, input);
    res.status(201).json({ role });
  })
);

roleRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const role = await getRole(req.params.id, orgId);
    res.json({ role });
  })
);

roleRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const input = updateRoleSchema.parse(req.body);
    const role = await updateRole(req.params.id, orgId, input);
    res.json({ role });
  })
);

roleRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    await deleteRole(req.params.id, orgId);
    res.status(204).end();
  })
);

roleRouter.get(
  "/:id/permissions",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const role = await getRole(req.params.id, orgId);
    res.json({ permissions: role.permissions });
  })
);

roleRouter.put(
  "/:id/permissions",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const input = updateRolePermissionsSchema.parse(req.body);
    const role = await updateRolePermissions(req.params.id, orgId, input);
    res.json({ role });
  })
);

const assignRoleSchema = z.object({
  roleId: z.string().nullable(),
});

roleRouter.post(
  "/members/:memberId",
  asyncHandler(async (req, res) => {
    const orgId = req.auth?.organizationId;
    if (!orgId) throw badRequest("Organization required", "ORGANIZATION_REQUIRED");
    const { roleId } = assignRoleSchema.parse(req.body);
    const member = await assignMemberRole(req.params.memberId, roleId, orgId);
    res.json({ member });
  })
);
