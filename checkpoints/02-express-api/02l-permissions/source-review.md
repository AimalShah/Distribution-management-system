# Checkpoint 2l — Permissions API: Source Review

## Source Review: `src/actions/permissions.ts` + `src/services/permissions.ts` + `src/lib/auth/permission.ts`

### Exported Functions

#### `isAdmin()`
- **Input:** None (uses session)
- **Returns:** Boolean — true if user has admin permissions
- **Logic:** Checks if user has `project: ["update", "delete"]` permissions

### Permission Model (`src/lib/auth/permission.ts`)

```typescript
const statement = {
  project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);
const member = ac.newRole({ project: ["create"] });
const adminRole = ac.newRole({ project: ["create", "update"] });
const owner = ac.newRole({ project: ["create", "update", "delete"] });
```

**Three roles:**
- `member` — create only
- `adminRole` — create + update
- `owner` — full CRUD

### Bugs/Assumptions

1. **Placeholder permission model** — only has `project` resource, no real DMS resources (inventory, sales, purchases, etc.)
2. `isAdmin()` checks for `project: ["update", "delete"]` which only `owner` role has
3. This is a known gap — Checkpoint 6 will rebuild RBAC with real resource/action statements
