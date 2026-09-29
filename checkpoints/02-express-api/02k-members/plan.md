# Checkpoint 2k — Members API: Plan

## Goal

Create Express router for organization member management.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/organizations/:id/members` | List org members |
| POST | `/api/organizations/:id/members` | Add member to org |
| DELETE | `/api/members/:id` | Remove member |
| GET | `/api/organizations/:id/available-users` | Get non-member users |

## Implementation

### Route: `apps/server/src/routes/member.ts`

Uses better-auth's organization plugin API for member management. Admin check on remove.

## Intentional Deviations

1. **Auth integration** — uses better-auth's member API
2. **Admin check** — enforced via middleware
