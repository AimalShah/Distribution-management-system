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

## Deviations From This Plan (as built)

1. **Auth integration.** better-auth is not a dependency of this monorepo; it
   arrives with checkpoint 3. The plan's two entries above are therefore not
   available to build on, and every operation is a direct Prisma write.

2. **Admin check — not middleware, and this is the point of the checkpoint.**
   The plan says the admin check is "enforced via middleware". The middleware
   that exists is the temporary stand-in in
   `apps/server/src/middleware/auth-context.ts`, which trusts a
   client-supplied `x-organization-id` and has no permission set to check a role
   against. A role check there would be checking a header the caller wrote.

   So the check is in the service, against the caller's own `Member` row for the
   organization in question: `requireElevatedMember` in
   `apps/server/src/services/member.ts`. Checkpoint 3 replaces the middleware;
   this is the part that has to survive the swap.

3. **The legacy admin check never ran, and the port is what fixes it.**
   `src/services/member.ts` was:

   ```ts
   const admin = await isAdmin()
   if (!isAdmin) { return { success: false, ... } }
   ```

   `isAdmin` is a function object, always truthy, so `!isAdmin` was always false
   and the guard never fired; the awaited `admin` was computed and discarded.
   `src/actions/members.ts` has the same shape, so `removeMember` there had no
   effective authorisation either. `DELETE /api/members/:id` in the legacy
   deleted on `where: { id }` with no organization and no user. Combined, that is
   a cross-tenant delete reachable by any authenticated user in the install for
   any member id they could read. Fixed by loading the membership to learn its
   organization, checking the caller against that organization, and repeating
   `organizationId` in the `delete` selector.

4. **`GET /available-users` was a user-table disclosure.** The legacy `getUsers`
   excluded the members of *this* organization and then ran
   `prisma.user.findMany({ where: { id: { notIn: memberUserIds } } })` — which
   is every other user in the installation, across every tenant, with email
   addresses, in a dropdown labelled "add someone to your organization". Now
   scoped to `User.organizationId = :id`. That column is the user's *active*
   organization rather than a membership, so it is a heuristic and not a truth;
   it is still the only tenant signal on the model, and Checkpoint 6 owns
   making membership authoritative.

5. **Mounted on `bootstrapAuthContext`, not `authContext`.** The organization is
   named in the path or read from the member row — a column the client cannot
   assert. Requiring `x-organization-id` on top would add a second source of
   tenant truth that can contradict the first. `userId` is still required on
   every route and answers 400 `USER_REQUIRED` before any query, because
   authorization here is per-user.

6. **Two routers, because the plan's paths straddle two prefixes.**
   `GET/POST /api/organizations/:id/members` and
   `GET /api/organizations/:id/available-users` are in `organizationMemberRouter`,
   mounted inside the existing `/api/organizations` stack *ahead of*
   `organizationRouter` — mounted anywhere later, the `notFoundHandler` that
   terminates that stack would swallow them. `DELETE /api/members/:id` and
   `PATCH /api/members/:id/role` are in `memberRouter` at `/api/members`.

7. **Two routes not in the plan.**

   - `POST /api/organizations/:id/members` was also listed in the 2j plan as
     `POST /api/organizations/:id/users`. Two paths for one action is a smell, so
     it is here at the path this plan specifies and #12 was amended to drop its
     copy.
   - `PATCH /api/members/:id/role`, because `Member.role` was set on insert and
     never again in the legacy, so there was no way to correct a mislabelled
     member except removing and re-adding them. Same guards as the other writes,
     including the last-owner check, because a demotion can empty the owner set
     as surely as a removal can.

8. **A last owner cannot be removed or demoted.** The database is happy with
   either: `Member.organizationId` is a plain foreign key and the last row is a
   valid one. After it, nobody holds an elevated role, so nobody can add anyone
   back — a one-way door. Checked by counting owners, and only asked when the row
   in question is an owner.

9. **The role vocabulary is unsettled and this does not fix it.** `memRole` in
   `src/actions/members.ts` is `"member" | "owner" | "adminRole"`;
   `User.role` in `src/actions/user.ts` is a separate `"user" | "admin"`; and
   `prisma/seed.ts` writes `"ADMIN"` and `"STAFF"`. `Member.role` is a plain
   `String` column, so none of it is enforced. The elevated check is exact and
   case-sensitive, which means a membership labelled `ADMIN` is *not* treated as
   elevated. That is deliberate — guessing at a role string is how privilege gets
   granted by accident — and Checkpoint 6 owns reconciling it.
