# Checkpoint 3 — Auth: Plan

## Goal

Port the better-auth configuration to work with Express, confirming the Express adapter covers organization + admin plugins.

## Steps

### 1. Verify better-auth Express adapter

- Confirm better-auth has an Express adapter or middleware
- Verify it supports:
  - Organization plugin (org creation, member management, invitations)
  - Admin plugin (user management, role assignment)
  - Email/password authentication
  - Email verification (Resend integration)
  - Session management with `activeOrganizationId`

### 2. Create `apps/server/src/auth/index.ts`

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@dms/db";
import { resend } from "./email";
import { admin, organization } from "better-auth/plugins";
import { ac, member, owner, adminRole } from "./permissions";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organization = await getActiveOrganization(session.userId);
          return { data: { ...session, activeOrganizationId: organization?.id } };
        },
      },
    },
  },
  user: {
    additionalFields: {
      organizationId: { type: "string", input: true, required: false },
      isOwner: { type: "boolean", input: true, required: false, defaultValue: false },
      isFormComplete: { type: "boolean", input: true, required: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!process.env.RESEND_API_KEY) return;
      await resend.emails.send({
        from: "Inventioo <onboarding@resend.dev>",
        to: user.email,
        subject: "Email Verification",
        html: `Click the link to verify your email: ${url}`,
      });
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(","),
  plugins: [
    organization({ organizationLimit: 5, ac, roles: { owner, adminRole, member } }),
    admin({ defaultRole: "admin" }),
  ],
});
```

### 3. Create `apps/server/src/middleware/auth.ts`

```typescript
import { auth } from "../auth";

export async function authMiddleware(req, res, next) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.auth = {
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId,
    role: session.user.role,
    isAdmin: /* check admin permission */,
  };
  next();
}
```

### 4. Create `apps/server/src/routes/auth.ts`

```typescript
import { Router } from "express";
import { auth } from "../auth";

const router = Router();

// Mount better-auth API handler
router.all("/api/auth/*", async (req, res) => {
  return auth.handler(req);
});

export default router;
```

### 5. Create `apps/web/src/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
  plugins: [organizationClient()],
});
```

### 6. Create `apps/web/src/hooks/use-auth.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../lib/auth-client";

export function useAuth() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => authClient.getSession(),
  });
}
```

## Intentional Deviations

1. **No dev fallback** — the mock user/session fallbacks in the original actions are NOT ported; Express returns 401 for unauthenticated requests
2. **Middleware-based auth** — replaces Next.js middleware with Express middleware
3. **React Query** — replaces SWR for auth state management (or keep SWR if preferred)

## Verification

- Login works with email/password
- Session persists across requests
- Org switching works
- Email verification sends via Resend
- Admin plugin can manage users
- Organization plugin handles org creation + member management
- Unauthenticated requests return 401
