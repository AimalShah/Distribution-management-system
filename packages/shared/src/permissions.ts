import { z } from "zod";

export const PERMISSION_STATEMENT = {
  inventory: ["view", "create", "update", "delete", "adjust", "export"],
  sales: ["view", "create", "update", "delete", "export"],
  purchases: ["view", "create", "update", "delete", "export"],
  returns: ["view", "create", "update", "delete"],
  customers: ["view", "create", "update", "delete"],
  suppliers: ["view", "create", "update", "delete"],
  products: ["view", "create", "update", "delete"],
  categories: ["view", "create", "update", "delete"],
  brands: ["view", "create", "update", "delete"],
  reports: ["view", "export"],
  settings: ["view", "update"],
  users: ["view", "create", "update", "delete"],
} as const;

export type PermissionResource = keyof typeof PERMISSION_STATEMENT;

export type PermissionAction<R extends PermissionResource = PermissionResource> =
  (typeof PERMISSION_STATEMENT)[R][number];

export interface PermissionItem {
  resource: PermissionResource;
  action: string;
}

export const DEFAULT_ROLES = {
  Admin: {
    name: "Admin",
    description: "Full access to all resources and management settings",
    permissions: Object.entries(PERMISSION_STATEMENT).flatMap(([resource, actions]) =>
      actions.map((action) => ({ resource: resource as PermissionResource, action }))
    ),
  },
  Sales: {
    name: "Sales",
    description: "Access to sales, customers, returns, products, and view reports/inventory",
    permissions: [
      { resource: "sales", action: "view" },
      { resource: "sales", action: "create" },
      { resource: "sales", action: "update" },
      { resource: "sales", action: "delete" },
      { resource: "customers", action: "view" },
      { resource: "customers", action: "create" },
      { resource: "customers", action: "update" },
      { resource: "customers", action: "delete" },
      { resource: "returns", action: "view" },
      { resource: "returns", action: "create" },
      { resource: "returns", action: "update" },
      { resource: "returns", action: "delete" },
      { resource: "products", action: "view" },
      { resource: "products", action: "create" },
      { resource: "products", action: "update" },
      { resource: "products", action: "delete" },
      { resource: "inventory", action: "view" },
      { resource: "reports", action: "view" },
    ] as PermissionItem[],
  },
  "Inventory Staff": {
    name: "Inventory Staff",
    description: "Manage inventory stock, stock adjustments, products, categories, and brands",
    permissions: [
      { resource: "inventory", action: "view" },
      { resource: "inventory", action: "create" },
      { resource: "inventory", action: "update" },
      { resource: "inventory", action: "adjust" },
      { resource: "products", action: "view" },
      { resource: "products", action: "create" },
      { resource: "products", action: "update" },
      { resource: "categories", action: "view" },
      { resource: "categories", action: "create" },
      { resource: "categories", action: "update" },
      { resource: "brands", action: "view" },
      { resource: "brands", action: "create" },
      { resource: "brands", action: "update" },
      { resource: "purchases", action: "view" },
      { resource: "returns", action: "view" },
      { resource: "reports", action: "view" },
    ] as PermissionItem[],
  },
  Manager: {
    name: "Manager",
    description: "View all resources, export reports, and update settings",
    permissions: [
      ...Object.keys(PERMISSION_STATEMENT).map((resource) => ({
        resource: resource as PermissionResource,
        action: "view",
      })),
      { resource: "reports", action: "export" },
      { resource: "settings", action: "update" },
    ] as PermissionItem[],
  },
} as const;

export function can(
  permissions: { resource: string; action: string }[],
  resource: PermissionResource,
  action: string
): boolean {
  return permissions.some(
    (p) =>
      (p.resource === resource || p.resource === "*") &&
      (p.action === action || p.action === "*")
  );
}

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(50),
  description: z.string().trim().max(255).optional(),
  permissions: z
    .array(
      z.object({
        resource: z.string().min(1),
        action: z.string().min(1),
      })
    )
    .default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(255).optional(),
  permissions: z
    .array(
      z.object({
        resource: z.string().min(1),
        action: z.string().min(1),
      })
    )
    .optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      resource: z.string().min(1),
      action: z.string().min(1),
    })
  ),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
