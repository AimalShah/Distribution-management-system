# Checkpoint 4j — Settings Pages: Plan

## Goal

Port settings pages to React + Vite.

## Implementation

### Routes:
- `apps/web/src/pages/settings/Profile.tsx` — profile settings
- `apps/web/src/pages/settings/Users.tsx` — user management
- `apps/web/src/pages/settings/Billing.tsx` — placeholder (keep as-is)
- `apps/web/src/pages/settings/Permission.tsx` — placeholder (keep as-is, Checkpoint 6 will rebuild)

### Components:
- `Profile` — profile card + change password form
- `UsersTable` — paginated user table
- `UserDialog` — add/edit user dialog

## Intentional Deviations

1. **Server-side pagination** — user list was client-side
2. **React Query** — replaces SWR
