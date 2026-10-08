import { z } from "zod";
import { memberRoleSchema } from "./organization";

/**
 * Adds someone who already has an account. It deliberately accepts no email,
 * password or name: the legacy `createUserForOrganizationService` took all three,
 * created the account through better-auth's `signUpEmail`, and then set
 * `emailVerified: true` on it -- which is how an admin-provisioned account skips
 * email verification. It could not be reproduced with direct Prisma writes in
 * any case, because `User` has no `password` column and better-auth keeps the
 * hash in `Account`. Only better-auth can mint a credential. Creating accounts
 * is Checkpoint 3's job.
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

export type AddMemberInput = z.output<typeof addMemberSchema>;

export type UpdateMemberRoleInput = z.output<typeof updateMemberRoleSchema>;
