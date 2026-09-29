# Checkpoint 2l — Permissions API: Plan

## Goal

Create Express middleware for permission checking that matches the current `isAdmin()` behavior.

## Implementation

### Middleware: `apps/server/src/middleware/permissions.ts`

```typescript
export function requireAdmin(req, res, next) {
  // Check if user has admin-level permissions
  // For now, this maps to the owner role (project: update + delete)
  // Checkpoint 6 will replace this with real RBAC
  if (!req.auth?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
```

## Intentional Deviations

1. **Placeholder preserved** — the current permission model is a placeholder; this checkpoint preserves it as-is
2. **Checkpoint 6 will rebuild** — real RBAC with resource/action statements comes later
