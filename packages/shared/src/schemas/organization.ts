import { z } from "zod";
import { nullableText } from "../inputs";
import { gstinSchema } from "./settings";

/**
 * The role vocabulary is unsettled in the source data, so this file records
 * which one it writes rather than which one exists.
 *
 * Three different sets are in play: `memRole` in src/actions/members.ts is
 * `"member" | "owner" | "adminRole"`, `Role` in src/actions/user.ts is
 * `"user" | "admin"` for the separate `User.role` column, and prisma/seed.ts
 * writes `"ADMIN"` and `"STAFF"` into rows the other two describe differently.
 * `Member.role` is a plain `String`, so nothing in the database enforces any of
 * it.
 *
 * This schema accepts the `memRole` set, because that is what the add-member
 * form submitted. Checkpoint 6 rebuilds RBAC and is where the three sets get
 * reconciled; nothing here tries to normalize rows that already exist.
 */
export const memberRoleSchema = z.enum(["member", "owner", "adminRole"]);

/**
 * `slug` is `@unique` on Organization (schema.prisma:93) and that index is
 * global, not per-organization, so a slug is a claim on a name across the whole
 * install rather than a name within one tenant. Two distributors cannot both be
 * `acme`, and the loser gets a 409 from a constraint they cannot see. That is
 * the schema as it stands; changing it is a migration question, not a
 * validation one, so this schema only insists the value is shaped like a slug.
 *
 * The pattern is enforced here because the column accepts anything: the legacy
 * forms sent a free-text company name into this field, and a slug containing a
 * space or a slash ends up in a path segment.
 */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(
      slugPattern,
      "Use lowercase letters, numbers and single hyphens, e.g. acme-distribution"
    ),
});

/**
 * `organizationId` arrives in the body rather than the path, so that
 * set-active stays a single-argument POST like the legacy server action. It is
 * still checked against the caller's memberships in the service; the body is a
 * claim, not an authorisation.
 */
export const setActiveOrganizationSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
});

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1, "Organization name cannot be blank").optional(),
  displayName: nullableText("Display name cannot be blank"),
  address: nullableText("Address cannot be blank"),
  gstin: gstinSchema,
});

export type OrganizationCreateInput = z.output<typeof organizationCreateSchema>;

export type OrganizationUpdateInput = z.output<typeof organizationUpdateSchema>;

export type SetActiveOrganizationInput = z.output<
  typeof setActiveOrganizationSchema
>;

export type MemberRole = z.output<typeof memberRoleSchema>;
