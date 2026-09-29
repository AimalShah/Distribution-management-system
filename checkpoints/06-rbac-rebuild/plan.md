# Checkpoint 6 — RBAC Rebuild: Plan

## Goal

Replace the placeholder `project`-only permission model with real resource/action statements for all DMS resources, default Admin/Sales/Inventory-staff roles, and dynamic custom-role support.

## Current State (from Checkpoint 2l source review)

```typescript
// Placeholder — only "project" resource
const statement = {
  project: ["create", "share", "update", "delete"],
} as const;
```

Three roles: member (create), adminRole (create+update), owner (full CRUD).

## Target State

### Permission Statements

```typescript
const statement = {
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
```

### Default Roles

| Role | Permissions |
|------|-------------|
| **Admin** | All permissions on all resources |
| **Sales** | view/create/update/delete on sales, customers, returns, products; view on inventory, reports |
| **Inventory Staff** | view/create/update/adjust on inventory, products, categories, brands; view on purchases, returns, reports |
| **Manager** | view on all resources; export on reports; update on settings |

### Custom Role Support

- `Role` model: id, name, organizationId, isSystem (boolean for default roles)
- `RolePermission` model: roleId, resource, action
- Admin UI for creating/editing custom roles
- Default roles are seeded and cannot be deleted (only custom roles can)

## Schema Changes

### New Prisma Models

```prisma
model Role {
  id            String          @id @default(cuid())
  name          String
  organizationId String
  isSystem      Boolean         @default(false)
  organization  Organization    @relation(fields: [organizationId], references: [id])
  permissions   RolePermission[]
  members       Member[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@unique([name, organizationId])
}

model RolePermission {
  id       String @id @default(cuid())
  roleId   String
  resource  String
  action   String
  role     Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, resource, action])
}
```

### Modified Member Model

Add `roleId` field to link members to roles (in addition to the existing better-auth role field).

## Implementation Steps

### 1. Schema migration
- Add `Role` and `RolePermission` models to `packages/db/prisma/schema.prisma`
- Create migration
- Seed default roles (Admin, Sales, Inventory Staff, Manager)

### 2. Permission definitions
- Create `packages/shared/src/permissions.ts` with the statement, roles, and permission types
- Export `can(resource, action)` helper function

### 3. Express middleware
- Create `apps/server/src/middleware/rbac.ts` with `requirePermission(resource, action)` middleware
- Replace the placeholder `requireAdmin` middleware

### 4. API routes
- `GET /api/roles` — list roles for current org
- `POST /api/roles` — create custom role
- `PUT /api/roles/:id` — update custom role
- `DELETE /api/roles/:id` — delete custom role
- `GET /api/roles/:id/permissions` — get role permissions
- `PUT /api/roles/:id/permissions` — update role permissions

### 5. React UI
- `apps/web/src/pages/settings/Roles.tsx` — role management page
- Role list table with edit/delete
- Role editor dialog with permission matrix (checkbox grid)
- Assign role to member in user management

## Verification

- Default roles are seeded correctly
- Permission checks work on all endpoints
- Custom roles can be created/edited/deleted
- Members can be assigned to roles
- Admin UI shows permission matrix
- `can()` helper correctly evaluates permissions
