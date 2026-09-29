# Checkpoint 2j — Organization API: Plan

## Goal

Create Express router for organization management.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/organizations` | List user's organizations |
| POST | `/api/organizations` | Create organization |
| GET | `/api/organizations/active` | Get current active organization |
| POST | `/api/organizations/set-active` | Set active organization |
| POST | `/api/organizations/:id/users` | Add user to organization |

## Implementation

### Route: `apps/server/src/routes/organization.ts`

Key considerations:
- Organization creation uses better-auth's organization plugin API
- `setActiveOrganization` updates the session record
- Org membership is managed through better-auth's member system

## Intentional Deviations

1. **Auth integration** — uses better-auth's organization plugin instead of direct Prisma calls
2. **Session management** — `setActiveOrganization` updates the session via better-auth API
