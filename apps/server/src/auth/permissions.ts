import { createAccessControl } from "better-auth/plugins/access";

/**
 * Ported as-is from the legacy `src/lib/auth/permission.ts`.
 *
 * `project` is a placeholder resource -- nothing in the DMS is a project -- and
 * it is kept only because better-auth's organization plugin needs *some*
 * statement to build its roles from, and changing what the three roles can do is
 * checkpoint 6's job, not this one's. The role names have to match
 * `MEMBER_ROLES` in `src/roles.ts`, which is what `Member.role` holds.
 */
const statement = {
  project: ["create", "share", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const member = ac.newRole({ project: ["create"] });
export const adminRole = ac.newRole({ project: ["create", "update"] });
export const owner = ac.newRole({ project: ["create", "update", "delete"] });
