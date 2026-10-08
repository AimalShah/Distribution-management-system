import { DEFAULT_ROLES } from "@dms/shared";

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
 * them count as elevated, which count as an owner, and what each one is
 * allowed to do. Answering it in each caller is how two guards in two files end
 * up disagreeing about the same person.
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

/**
 * The permissions a role grants, as the pairs `can()` evaluates.
 *
 * `resource` is `string` rather than `PermissionResource` because an owner's
 * wildcard is deliberately not a key of `PERMISSION_STATEMENT`: `can()` accepts
 * `"*"`, and nothing else in the vocabulary can express "all of them".
 */
export type RolePermissions = readonly { resource: string; action: string }[];

/**
 * What a `Member.role` *string* grants, when the row has no `customRole`.
 *
 * This is the data `services/rbac.ts` used to inline, and it belongs here for
 * the same reason the names do: the guard, the member routes and any future
 * caller have to reach the same verdict about the same row. `customRole` is
 * authoritative when it is present, so these keys are the fallback vocabulary
 * only -- lowercase, because `permissionsForRole` lowercases the row before it
 * looks. The case-sensitivity of `MEMBER_ROLES` above is a separate question and
 * is left alone; reconciling the two is checkpoint 6's work.
 */
/**
 * The lookup itself: a role string, lowercased by `permissionsForRole`, to what
 * it grants. The index is `string` because a `Member.role` is free text until
 * this table is consulted, and an unrecognised one has to fall through to
 * `MEMBER_FALLBACK_PERMISSIONS` rather than throw.
 */
interface RoleStringPermissions {
  readonly [role: string]: RolePermissions;
}

const ROLE_STRING_PERMISSIONS: RoleStringPermissions = {
  [MEMBER_ROLES.owner]: [{ resource: "*", action: "*" }],
  admin: DEFAULT_ROLES.Admin.permissions,
  adminrole: DEFAULT_ROLES.Admin.permissions,
  sales: DEFAULT_ROLES.Sales.permissions,
  manager: DEFAULT_ROLES.Manager.permissions,
};

/**
 * The grant for a row whose role string names no role above -- `member`, and
 * anything a legacy form ever wrote.
 *
 * Read-only, and only on the resources a member can be expected to look at.
 * It is not a courtesy default: `services/rbac.ts` answers an empty list for a
 * user with no membership at all, and a tenant's own members are the case this
 * list exists for.
 */
export const MEMBER_FALLBACK_PERMISSIONS: RolePermissions = [
  { resource: "products", action: "view" },
  { resource: "categories", action: "view" },
  { resource: "brands", action: "view" },
  { resource: "inventory", action: "view" },
];

/**
 * The permissions a `Member.role` string grants. `customRole` is resolved
 * before this is consulted; see `getMemberPermissions` for the precedence.
 */
export function permissionsForRole(role: string): RolePermissions {
  const key = role.toLowerCase();

  if (key.includes("inventory")) {
    return DEFAULT_ROLES["Inventory Staff"].permissions;
  }

  return ROLE_STRING_PERMISSIONS[key] ?? MEMBER_FALLBACK_PERMISSIONS;
}
