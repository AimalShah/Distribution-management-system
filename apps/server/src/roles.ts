/**
 * The role vocabulary, in one place, because it now has more than one consumer
 * and they have to agree.
 *
 * `memberRoleSchema` in `@dms/shared` is the authority for the *names* — the
 * `memRole` set the legacy add-member form submitted, which is what
 * `Member.role` actually holds. Its own comment records the other two
 * vocabularies in play (`User.role`'s `"user" | "admin"`, and the seed's
 * `"ADMIN"` / `"STAFF"`) and why nothing here normalises them.
 *
 * What this file adds is the question the names alone cannot answer: which of
 * them count as elevated, and which count as an owner. Answering it in each
 * caller is how two guards in two files end up disagreeing about the same
 * person.
 *
 * The comparisons are exact and case-sensitive. A row labelled `ADMIN` is
 * therefore *not* elevated here, which is a real limitation and a deliberate
 * one: normalising a role string is how privilege gets granted by accident, and
 * checkpoint 6 owns reconciling the vocabulary properly.
 */
export const MEMBER_ROLES = {
  member: "member",
  owner: "owner",
  adminRole: "adminRole",
} as const;

/**
 * May change an organization's membership. `adminRole` reads like a typo for
 * "admin", but it is the string in the legacy form and in the shared schema, and
 * renaming it here would mean the guard and the validator disagree.
 */
export const ELEVATED_ROLES: readonly string[] = [
  MEMBER_ROLES.owner,
  MEMBER_ROLES.adminRole,
];

export const isElevated = (role: string): boolean =>
  ELEVATED_ROLES.includes(role);

/**
 * Owner only, which is a stricter question than `isElevated` and deliberately
 * not the same one.
 *
 * The legacy `isAdmin()` asked better-auth for `project: ["update", "delete"]`,
 * and of the three defined roles only `owner` has `delete` — so `isAdmin()` was
 * true for an owner and false for an `adminRole`, however elevated that role
 * looks. Checkpoint 2l's `requireAdmin` preserves that. Member management in 2k
 * asks the looser question, so an `adminRole` can add and remove members but
 * cannot satisfy `requireAdmin`.
 */
export const isOwner = (role: string): boolean => role === MEMBER_ROLES.owner;
