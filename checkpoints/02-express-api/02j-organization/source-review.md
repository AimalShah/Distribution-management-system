# Checkpoint 2j — Organization API: Source Review

## Source Review: `src/actions/organization.ts` + `src/services/organization.ts`

### Exported Functions

#### `createOrganization(name: string, slug: string)`
- **Input:** Organization name and slug
- **Side effects:** Creates Organization record via auth API
- **Returns:** Created organization

#### `createUserForOrganization(email, password, name, role)`
- **Input:** User email, password, name, role
- **Side effects:** Creates user + adds as member to org
- **Returns:** Created user

#### `getActiveOrganization(userId: string)`
- **Input:** User ID
- **Returns:** First organization for the user

#### `getUserOrganization()`
- **Input:** None (uses session)
- **Returns:** All user organizations with members

#### `getCurrentActiveOrganization()`
- **Input:** None (uses session)
- **Returns:** Current active org from session

#### `setActiveOrganization(organizationId: string)`
- **Input:** Organization ID
- **Side effects:** Updates session with active org ID
- **Returns:** None

### Service Layer

- `createOrganizationService(userId, name, slug)` — creates org via auth API
- `createUserForOrganizationService(orgId, email, password, name, role)` — creates user + adds member
- `getActiveOrganizationService(userId)` — gets first org for user
- `getUserOrganizationsService(userId)` — gets all user orgs with members
- `getCurrentActiveOrganizationService(activeOrgId)` — gets org by ID
- `setActiveOrganizationService(sessionId, orgId, userId)` — updates session

### Bugs/Assumptions

1. Organization creation goes through better-auth's organization plugin API, not direct Prisma
2. `setActiveOrganization` updates the session record directly
3. No validation on organization name/slug format
