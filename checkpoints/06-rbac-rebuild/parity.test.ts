/**
 * Checkpoint 6 — RBAC Rebuild: Parity Test
 *
 * Scope:
 * 1. Permission statement contract covering all 12 DMS resources:
 *    inventory, sales, purchases, returns, customers, suppliers, products,
 *    categories, brands, reports, settings, users.
 * 2. Default roles contract: Admin, Sales, Inventory Staff, Manager with correct action mappings.
 * 3. can() evaluator behavioral tests for wildcard, resource/action matches, and rejections.
 * 4. System guards: default roles cannot be deleted or renamed.
 * 5. Route mounting: /api/roles endpoints mounted and routed.
 * 6. UI contract: PermissionPage renders role matrix, custom role management, and dialogs.
 * 7. Live DB tests (when database is available): seeding default roles, custom role lifecycle,
 *    permission resolution, member assignment, and deletion guards.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import {
  can,
  DEFAULT_ROLES,
  PERMISSION_STATEMENT,
  createRoleSchema,
  updateRoleSchema,
  type PermissionResource,
} from "@dms/shared";
import { createApp } from "../../apps/server/src/app";
import {
  hasDatabase,
  prisma,
  unique,
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../support/parity-db";
import {
  assignMemberRole,
  checkPermission,
  createRole,
  deleteRole,
  getRole,
  listRoles,
  seedDefaultRoles,
  updateRole,
  updateRolePermissions,
} from "../../apps/server/src/services/rbac";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);
  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 6 — RBAC Rebuild (Contract & Unit)", () => {
  it("defines permission statements for all 12 DMS resources", () => {
    const resources = Object.keys(PERMISSION_STATEMENT);
    const expectedResources: PermissionResource[] = [
      "inventory",
      "sales",
      "purchases",
      "returns",
      "customers",
      "suppliers",
      "products",
      "categories",
      "brands",
      "reports",
      "settings",
      "users",
    ];

    expect(resources.sort()).toEqual(expectedResources.sort());

    // Verify key actions
    expect(PERMISSION_STATEMENT.inventory).toContain("adjust");
    expect(PERMISSION_STATEMENT.sales).toContain("export");
    expect(PERMISSION_STATEMENT.purchases).toContain("create");
    expect(PERMISSION_STATEMENT.reports).toEqual(["view", "export"]);
    expect(PERMISSION_STATEMENT.settings).toEqual(["view", "update"]);
  });

  it("defines default roles: Admin, Sales, Inventory Staff, Manager", () => {
    expect(DEFAULT_ROLES).toHaveProperty("Admin");
    expect(DEFAULT_ROLES).toHaveProperty("Sales");
    expect(DEFAULT_ROLES).toHaveProperty("Inventory Staff");
    expect(DEFAULT_ROLES).toHaveProperty("Manager");

    // Admin has permissions on all 12 resources
    const adminResources = new Set(DEFAULT_ROLES.Admin.permissions.map((p) => p.resource));
    expect(adminResources.size).toBe(12);

    // Sales has sales, customers, returns, products, inventory view, reports view
    const salesPermissions = DEFAULT_ROLES.Sales.permissions;
    expect(salesPermissions.some((p) => p.resource === "sales" && p.action === "create")).toBe(true);
    expect(salesPermissions.some((p) => p.resource === "settings" && p.action === "update")).toBe(false);

    // Inventory Staff has inventory adjust, but cannot delete products or view settings
    const invPermissions = DEFAULT_ROLES["Inventory Staff"].permissions;
    expect(invPermissions.some((p) => p.resource === "inventory" && p.action === "adjust")).toBe(true);
    expect(invPermissions.some((p) => p.resource === "products" && p.action === "delete")).toBe(false);

    // Manager can view all resources and export reports
    const mgrPermissions = DEFAULT_ROLES.Manager.permissions;
    expect(mgrPermissions.some((p) => p.resource === "reports" && p.action === "export")).toBe(true);
    expect(mgrPermissions.some((p) => p.resource === "users" && p.action === "delete")).toBe(false);
  });

  it("evaluates permissions correctly with can() helper", () => {
    const permissions = [
      { resource: "sales", action: "view" },
      { resource: "sales", action: "create" },
      { resource: "inventory", action: "view" },
    ];

    expect(can(permissions, "sales", "view")).toBe(true);
    expect(can(permissions, "sales", "create")).toBe(true);
    expect(can(permissions, "sales", "delete")).toBe(false);
    expect(can(permissions, "settings", "view")).toBe(false);

    // Wildcards
    const superAdmin = [{ resource: "*", action: "*" }];
    expect(can(superAdmin, "settings", "update")).toBe(true);
    expect(can(superAdmin, "inventory", "adjust")).toBe(true);
  });

  it("validates role creation and update schemas", () => {
    // Valid creation
    const valid = createRoleSchema.safeParse({
      name: "Warehouse Auditor",
      description: "Audits inventory counts",
      permissions: [{ resource: "inventory", action: "view" }],
    });
    expect(valid.success).toBe(true);

    // Missing name fails
    const missingName = createRoleSchema.safeParse({
      permissions: [],
    });
    expect(missingName.success).toBe(false);

    // Empty name fails
    const emptyName = createRoleSchema.safeParse({
      name: "   ",
    });
    expect(emptyName.success).toBe(false);
  });

  it("schema declares Role and RolePermission models with relations", () => {
    const schema = read("packages/db/prisma/schema.prisma");
    expect(schema).toContain("model Role {");
    expect(schema).toContain("model RolePermission {");
    expect(schema).toContain("isSystem");
    expect(schema).toContain("roleId");
    expect(schema).toContain("customRole");
  });

  it("mounts role routes under /api/roles", () => {
    const routesIndex = read("apps/server/src/routes/index.ts");
    expect(routesIndex).toContain('apiRouter.use("/roles", roleRouter)');
  });

  it("web UI renders role matrix and permission management page", () => {
    const permPage = read("apps/web/src/pages/PermissionPage.tsx");
    expect(permPage).toContain("Permissions & Roles");
    expect(permPage).toContain("Role Matrix");
    expect(permPage).toContain("Role Management");
    expect(permPage).toContain("Create Custom Role");
    expect(permPage).toContain("PERMISSION_STATEMENT");
    expect(permPage).toContain("DEFAULT_ROLES");
    expect(permPage).toContain("ConfirmDialog");
  });
});

describe.skipIf(!hasDatabase)("Checkpoint 6 — RBAC Rebuild (Live Database)", () => {
  let orgId: string;
  let userId: string;
  let memberId: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp({ authMode: "header" });

    // Create unique organization
    const org = await prisma.organization.create({
      data: {
        name: unique("RBAC Org"),
        slug: unique("rbac-org").toLowerCase(),
      },
    });
    orgId = org.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: `${unique("rbac-user")}@example.test`.toLowerCase(),
      },
    });
    userId = user.id;

    // Create member
    const member = await prisma.member.create({
      data: {
        organizationId: orgId,
        userId: userId,
        role: "member",
      },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.member.deleteMany({ where: { organizationId: orgId } });
      await prisma.rolePermission.deleteMany({
        where: { role: { organizationId: orgId } },
      });
      await prisma.role.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("seeds default system roles for organization", async () => {
    await seedDefaultRoles(orgId);
    const roles = await listRoles(orgId);

    const names = roles.map((r) => r.name);
    expect(names).toContain("Admin");
    expect(names).toContain("Sales");
    expect(names).toContain("Inventory Staff");
    expect(names).toContain("Manager");

    const adminRole = roles.find((r) => r.name === "Admin");
    expect(adminRole?.isSystem).toBe(true);
    expect(adminRole?.permissions.length).toBeGreaterThanOrEqual(30);
  });

  it("prevents renaming or deleting system roles", async () => {
    const roles = await listRoles(orgId);
    const adminRole = roles.find((r) => r.name === "Admin")!;

    await expect(
      updateRole(adminRole.id, orgId, { name: "SuperAdmin" })
    ).rejects.toThrow();

    await expect(deleteRole(adminRole.id, orgId)).rejects.toThrow();
  });

  it("creates, updates, and deletes custom roles", async () => {
    const custom = await createRole(orgId, {
      name: "Custom Dispatcher",
      description: "Handles dispatches and delivery",
      permissions: [
        { resource: "sales", action: "view" },
        { resource: "returns", action: "create" },
      ],
    });

    expect(custom.name).toBe("Custom Dispatcher");
    expect(custom.isSystem).toBe(false);
    expect(custom.permissions.length).toBe(2);

    // Update permissions
    const updated = await updateRolePermissions(custom.id, orgId, {
      permissions: [
        { resource: "sales", action: "view" },
        { resource: "sales", action: "create" },
        { resource: "inventory", action: "view" },
      ],
    });
    expect(updated.permissions.length).toBe(3);

    // Delete custom role
    await deleteRole(custom.id, orgId);
    await expect(getRole(custom.id, orgId)).rejects.toThrow();
  });

  it("assigns member to role and enforces permission evaluation", async () => {
    const role = await createRole(orgId, {
      name: "Sales Rep",
      permissions: [
        { resource: "sales", action: "view" },
        { resource: "sales", action: "create" },
      ],
    });

    // Assign member to role
    await assignMemberRole(memberId, role.id, orgId);

    const canSalesView = await checkPermission(userId, orgId, "sales", "view");
    const canSalesCreate = await checkPermission(userId, orgId, "sales", "create");
    const canSettingsUpdate = await checkPermission(userId, orgId, "settings", "update");

    expect(canSalesView).toBe(true);
    expect(canSalesCreate).toBe(true);
    expect(canSettingsUpdate).toBe(false);

    // Guard: cannot delete role while members are assigned
    await expect(deleteRole(role.id, orgId)).rejects.toThrow();

    // Unassign role
    await assignMemberRole(memberId, null, orgId);

    // Now delete succeeds
    await deleteRole(role.id, orgId);
  });

  it("serves role endpoints via HTTP API", async () => {
    const res = await request(app)
      .get("/api/roles")
      .set(ORGANIZATION_HEADER, orgId)
      .set(USER_HEADER, userId);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("roles");
    expect(Array.isArray(res.body.roles)).toBe(true);
  });
});
