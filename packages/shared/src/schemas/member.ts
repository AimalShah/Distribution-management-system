import { z } from "zod";
import { memberRoleSchema } from "./organization";

/**
 * Adds someone who already has an account. It deliberately accepts no email,
 * password or name: the legacy `createUserForOrganizationService` took all three,
 * created the account through better-auth's `signUpEmail`, and then set
 * `emailVerified: true` on it -- which is how an admin-provisioned account skips
 * email verification. Creating accounts is now P0-5 `addStaffSchema`'s job;
 * this schema adds a member to an account that already exists, as before.
 */
export const addMemberSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  role: memberRoleSchema.default("member"),
});

/**
 * Why the role arrives as a single string and not the legacy
 * `"member" | "owner" | "adminRole" | (...)[]` union: the array form was a
 * React multi-select artefact, and `Member.role` is a plain `String` column, so
 * an array would have been written as `"member,owner"` and matched nothing.
 */
export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

/**
 * P0-5 staff provisioning: the owner creates the account itself, with an
 * initial temporary password the staff must replace at first login.
 *
 * The provisioned account is created with `emailVerified: true` on the
 * server -- the owner is vouching for the address they typed, exactly the
 * decision the legacy `createUserForOrganizationService` made. `tempPassword`
 * matches better-auth's own sign-up floor (8 characters, the default
 * `minPasswordLength`).
 */
export const addStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  email: z.email("Enter a valid email address").max(320, "Email is too long"),
  tempPassword: z
    .string()
    .min(8, "The temporary password must be at least 8 characters")
    .max(128, "The temporary password is too long"),
  role: memberRoleSchema.default("member"),
});

/**
 * The member lifecycle beyond role changes (P0-5): deactivate keeps the row and
 * the history but rejects the user at every authenticated route and kills their
 * sessions; reactivate turns the account back on. `reason` is recorded as the
 * user-visible ban reason when deactivating, and is only read there.
 */
export const setMemberStatusSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().max(300, "The reason is too long").optional(),
});

/**
 * The forced first-login password change (P0-5). Submitted on its own endpoint
 * while every Tenant route still refuses the session, so there is no way into
 * the app's data with a temporary password still in force.
 */
export const firstPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter the temporary password"),
  newPassword: z
    .string()
    .min(8, "The new password must be at least 8 characters")
    .max(128, "The new password is too long"),
});

export type AddMemberInput = z.output<typeof addMemberSchema>;

export type UpdateMemberRoleInput = z.output<typeof updateMemberRoleSchema>;

export type AddStaffInput = z.output<typeof addStaffSchema>;

export type SetMemberStatusInput = z.output<typeof setMemberStatusSchema>;

export type FirstPasswordChangeInput = z.output<typeof firstPasswordChangeSchema>;
