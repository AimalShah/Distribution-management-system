# Checkpoint 2k — Members API: Source Review

## Source Review: `src/actions/members.ts` + `src/services/member.ts`

### Exported Functions

#### `addMember(organizationId, userId, role)`
- **Input:** Organization ID, User ID, role ("member" | "owner" | "adminRole")
- **Side effects:** Adds member via auth API
- **Returns:** Created member

#### `removeMember(memberId: string)`
- **Input:** Member ID
- **Side effects:** Removes member (admin only)
- **Returns:** None

#### `getUsers(organizationId: string)`
- **Input:** Organization ID
- **Returns:** Non-member users (available to add)

### Service Layer

- `addMember(organizationId, userId, role)` — adds member via auth API
- `removeMember(memberId)` — removes member with admin check

### Bugs/Assumptions

1. Member management goes through better-auth's organization plugin
2. `removeMember` has admin-only check
3. `getUsers` returns users not already in the org
