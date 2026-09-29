# Checkpoint 4j — Settings Pages: Source Review

## Source Review: `src/app/(app)/(settings)/*` + `src/components/profile.tsx` + `src/components/usersTable.tsx` + `src/components/UserDialog.tsx`

### Pages

#### `/settings/profile` — `profile/page.tsx`
- Profile settings with ProfileCard + ChangePasswordForm
- Fields: name, email, company info, avatar
- Change password: current, new, confirm

#### `/settings/users` — `users/page.tsx`
- User management with UsersTable + UserDialog
- Add/edit/delete users
- Role assignment

#### `/settings/billing` — `billing/page.tsx`
- Placeholder — "billing page"

#### `/settings/permission` — `permission/page.tsx`
- Placeholder — "Permission page"

### Components

#### `Profile.tsx`
- ProfileCard: shows user info, edit profile form
- ChangePasswordForm: change password with validation

#### `usersTable.tsx`
- Table with users in current org
- Columns: Name, Email, Role, Actions

#### `UserDialog.tsx`
- Dialog for add/edit user
- Fields: name, email, password (for new), role

### Bugs/Assumptions

1. Billing and permission pages are placeholders
2. User management uses better-auth's admin plugin
