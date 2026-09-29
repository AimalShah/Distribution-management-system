# Checkpoint 3 — Auth: Source Review

## Source Review: `src/lib/auth.ts` + `src/lib/auth/permission.ts` + `src/actions/session.ts` + `src/actions/user.ts`

### `src/lib/auth.ts` (87 lines)

**Configuration:**
- `betterAuth` with Prisma adapter (PostgreSQL)
- Email/password enabled with auto-signin
- Email verification via Resend (skipped if `RESEND_API_KEY` not set)
- `requireEmailVerification` controlled by env var `REQUIRE_EMAIL_VERIFICATION`
- Trusted origins from `TRUSTED_ORIGINS` env var (comma-separated)

**Plugins:**
1. `organization` — organization limit: 5, with custom roles (owner, adminRole, member)
2. `admin` — default role: "admin"

**Database hooks:**
- Session create: looks up active organization for user and sets `activeOrganizationId`

**User additional fields:**
- `organizationId` (string, optional)
- `isOwner` (boolean, default false)
- `isFormComplete` (boolean, optional)

### `src/lib/auth/permission.ts` (21 lines)

**Permission model:**
```typescript
const statement = {
  project: ["create", "share", "update", "delete"],
} as const;
```

**Three roles:**
- `member` — project: ["create"]
- `adminRole` — project: ["create", "update"]
- `owner` — project: ["create", "update", "delete"]

**Note:** This is a placeholder permission model — only has `project` resource, no real DMS resources. Checkpoint 6 will rebuild RBAC.

### `src/actions/session.ts`

#### `getCurrentUserSession()`
- Gets current session from better-auth
- Has dev fallback: if no session, returns a mock session for development

### `src/actions/user.ts`

#### `getCurrentUser()`
- Gets current user from better-auth session
- Has dev fallback: returns mock user for development

#### `getCurrentUserActiveOrganizationId()`
- Gets active org ID from session

#### `createUserForOrganization(email, password, name, role)`
- Creates user (admin only)
- Role type: `"user" | "admin"`

#### `deleteUser(userId: string)`
- Removes user

#### `getOrganizationUser()`
- Gets users in current org

### `src/lib/auth-client.ts`

Better-auth client configuration for the frontend.

### `src/middleware.ts`

Next.js middleware for route protection — checks session and redirects to login if not authenticated.

### Bugs/Assumptions

1. **Dev fallback** — `getCurrentUserSession` and `getCurrentUser` have mock fallbacks for development — these should NOT be ported to production Express
2. **Placeholder permissions** — only `project` resource exists; real DMS permissions come in Checkpoint 6
3. **Organization plugin** — uses better-auth's organization plugin which handles org creation, member management, invitations
4. **Admin plugin** — uses better-auth's admin plugin for user management
5. **Session-based org switching** — `setActiveOrganization` updates the session record directly
