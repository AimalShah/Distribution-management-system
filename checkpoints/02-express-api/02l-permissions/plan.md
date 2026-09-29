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

## Deviations From This Plan (as built)

### The legacy permission system was inert, and this checkpoint's first job is saying so

The plan describes `requireAdmin` as preserving current behaviour. The current
behaviour is that **no check ever ran**. `isAdmin()` exists in
`src/actions/permissions.ts` and `src/services/permissions.ts`, both declared
`export async function isAdmin()` and both returning an *object* —
`{ success, message }` — despite the source review recording its return type as
`Boolean`.

It has exactly three call sites, and every one of them compared the object rather
than `.success`. An object is always truthy, so `if (!admin)` was always false:

| Call site | Guard | Outcome |
|---|---|---|
| `src/actions/members.ts:30` | `if (!isAdmin)` | function object — always truthy |
| `src/services/member.ts:33` | `if (!isAdmin)` | function object — always truthy |
| `src/actions/user.ts:106` | `if (!admin)` | `{ success }` object — always truthy |

The third is the one that matters for scope: `createUserForOrganization`, which
mints an account and sets `emailVerified: true` on it, was reachable by any
authenticated user. 2k already replaced two of the three with service-level
checks that actually run; the third disappears in checkpoint 3, which is where
user creation moves. `isAdmin()` also returns `{ succes: false }` — one `s` — on
a thrown error, so a caller reading `.success` sees `undefined`. That happens to
fail closed, but only by accident.

This is written down because the obvious assumption for the next reviewer is "the
guard was in place and working", and that assumption is false.

### Deviations

1. **`req.auth.isAdmin` does not exist, and `requireAdmin` does not read one.**
   The plan's sketch is `if (!req.auth?.isAdmin)`. `authContext` fills
   `req.auth` from headers the client chose, so an `isAdmin` flag carried on it
   is a flag the client wrote — that check would be asking the caller whether
   they are an administrator. The role is read from the caller's own `Member`
   row instead, via `isAdmin(userId, organizationId)` in
   `apps/server/src/services/permissions.ts`.

2. **The organization comes from the header, so the middleware expects the
   strict mount.** `requireAdmin` reads `req.auth.organizationId`, which means
   it is meant for routers behind `authContext`. A route that names its
   organization in the path has no tenant header to read, and mounting this on
   one would check the wrong organization — so those check in the service
   instead, which is what 2k's member routes do.

3. **Owner only, which is stricter than 2k.** `isAdmin()` asked better-auth for
   `project: ["update", "delete"]`, and of the three roles in
   `src/lib/auth/permission.ts` only `owner` has `delete`. So `adminRole` is not
   an admin. Preserved exactly, and it is deliberately *not* the same question as
   2k's "elevated": an `adminRole` can add and remove members, and cannot satisfy
   `requireAdmin`. Both comparisons now live in `apps/server/src/roles.ts` so they
   cannot drift apart unnoticed.

4. **The two legacy `isAdmin()` copies asked for different permission sets.**
   `actions/permissions.ts` asked for `project: ["update", "delete"]` and
   `services/permissions.ts` for `project: ["create", "update", "delete"]`.
   Against the role definitions both come out the same — only `owner` satisfies
   either — so the divergence never showed. It is a sign the two copies were not
   kept in step, and it is why there is now one.

5. **`getMemberRole` alongside `isAdmin`.** "What can this person do" and "is
   this person an admin" are different questions, and 2k needs the first.

6. **Nothing is mounted on this yet.** `requireAdmin` is exercised against a
   purpose-built route in `permissions.test.ts` rather than a production one,
   because no route in the current API is owner-only: the legacy only guarded
   member removal and user creation, and 2k now checks the first in the service
   and checkpoint 3 absorbs the second. Deciding which DMS resources are
   owner-only versus admin-level is checkpoint 6's question, and answering it
   early would be guessing. So this checkpoint ships the guard and its tests, and
   wiring is a one-line change per route once 6 has decided.
