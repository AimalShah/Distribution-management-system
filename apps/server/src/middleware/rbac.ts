import type { Request, RequestHandler } from "express";
import type { PermissionAction, PermissionResource } from "@dms/shared";
import { badRequest, forbidden } from "../http/errors";
import { checkPermission } from "../services/rbac";
import { USER_HEADER } from "./auth-context";

/**
 * One permission question: may this caller do *this* to *that*?
 *
 * Every route under `/api` resolves to one of these before it runs. There is no
 * third outcome: an unknown route answers 404 from the router, and a route
 * nobody mapped would be caught by the mount-coverage test rather than quietly
 * guarded by nothing.
 */
export interface PermissionRequirement {
  readonly resource: PermissionResource;
  readonly action: PermissionAction;
}

/**
 * A path below a segment whose action is not what its verb would say.
 *
 * `POST /inventory/adjust` creates no inventory row -- it moves stock, which is
 * what `inventory:adjust` exists for. Paths are relative to the segment and may
 * contain `:param` parts, each of which matches exactly one path segment. The
 * resource is not repeated here: a rule narrows how one segment is read, it
 * never moves the request to a different resource.
 */
export interface RoutePermissionRule {
  readonly method: string;
  readonly path: string;
  readonly action: PermissionAction;
}

/**
 * How one URL segment under `/api` is guarded: the resource it belongs to, plus
 * the exceptions to the verb rule below.
 *
 * The verb rule is the only convention a reader has to hold: `GET` reads
 * (`view`), `POST` writes something new (`create`), `PUT`/`PATCH` rewrite what is
 * there (`update`), `DELETE` removes it (`delete`). It is applied to every
 * segment, so a route added later is guarded before anyone writes a row for it,
 * and a verb the map does not name (nothing in `express` routes `TRACE`) needs no
 * decision because it cannot reach a handler.
 */
export interface SegmentPermission {
  readonly resource: PermissionResource;
  readonly rules?: readonly RoutePermissionRule[];
}

/** First path segment under `/api` -> what it asks for. See `routes/index.ts`. */
export type RoutePermissionTable = Readonly<Record<string, SegmentPermission>>;

/**
 * The verb rule's own vocabulary: a method string, however odd, to the action
 * that method asks for.
 *
 * Named so the table below is a contract rather than an anonymous mapping, and
 * because `resolveRequirement` has to answer for any method Express hands it --
 * including one no handler exists for, which is why the index is `string` and
 * the lookup is allowed to come back empty.
 */
interface VerbActions {
  readonly [method: string]: PermissionAction;
}

const VERB_ACTIONS: VerbActions = {
  GET: "view",
  HEAD: "view",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/** `:param` matches one segment, a literal has to match it exactly. */
const matchesRulePath = (pattern: string, actual: readonly string[]): boolean => {
  const parts = pattern.split("/").filter(Boolean);

  if (parts.length !== actual.length) {
    return false;
  }

  return parts.every((part, index) => part.startsWith(":") || part === actual[index]);
};

/**
 * What a request to `path` with `method` has to prove, or `null` when it has to
 * prove nothing because no handler exists to reach.
 *
 * `null` is not "allowed". It is "this map has nothing to say", and the only
 * ways to reach it are a path no router is mounted at (404 next) or a verb no
 * route uses (nothing next). A segment the map *does* name always yields a
 * requirement, which is what makes a newly added route fail closed.
 */
export function resolveRequirement(
  table: RoutePermissionTable,
  method: string,
  path: string
): PermissionRequirement | null {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const [segment, ...rest] = segments;
  const entry = table[segment];

  if (!entry) {
    return null;
  }

  const verb = method === "HEAD" ? "GET" : method;
  const action = VERB_ACTIONS[verb];

  if (!action) {
    return null;
  }

  for (const rule of entry.rules ?? []) {
    if (rule.method === verb && matchesRulePath(rule.path, rest)) {
      return { resource: entry.resource, action: rule.action };
    }
  }

  return { resource: entry.resource, action };
}

/**
 * The check itself, shared by the two adapters below.
 *
 * Fail closed at both ends, and in the same order the rest of the stack does:
 * no tenant is a 400 (the request cannot be scoped), no user is a 400 (the
 * request cannot be attributed), and a caller the tenant has not granted the
 * permission to is a 403. `middleware/permissions.ts` states why the middle one
 * matters: a guard that treats "no context" as "no restriction" is a guard that
 * can be switched off by omitting a header.
 */
async function assertPermission(
  req: Request,
  requirement: PermissionRequirement
): Promise<void> {
  const organizationId = req.auth?.organizationId;

  if (!organizationId) {
    throw badRequest("Missing organization context", "ORGANIZATION_REQUIRED");
  }

  const userId = req.auth?.userId;

  if (!userId) {
    throw badRequest(
      `Missing user context. Send the ${USER_HEADER} header.`,
      "USER_REQUIRED"
    );
  }

  const allowed = await checkPermission(
    userId,
    organizationId,
    requirement.resource,
    requirement.action
  );

  if (!allowed) {
    throw forbidden(
      `Permission denied: requires ${requirement.resource}:${requirement.action}`,
      "PERMISSION_DENIED"
    );
  }
}

/** One fixed question, for a route that names its own permission. */
export function requirePermission(
  resource: PermissionResource,
  action: PermissionAction
): RequestHandler {
  return (req, _res, next) => {
    void assertPermission(req, { resource, action })
      .then(() => next())
      .catch(next);
  };
}

/**
 * The same check, asked by the request itself.
 *
 * This is the adapter `routes/index.ts` mounts once, in front of every router,
 * so the mapping sits next to the mount and both are visible in one file. It
 * reads `req.path` rather than `req.originalUrl`: by the time it runs, Express
 * has already stripped the `/api` mount, so the path it sees is the same shape
 * the table above is keyed on.
 */
export function requireRoutePermission(table: RoutePermissionTable): RequestHandler {
  return (req, _res, next) => {
    const requirement = resolveRequirement(table, req.method, req.path);

    if (!requirement) {
      next();

      return;
    }

    void assertPermission(req, requirement)
      .then(() => next())
      .catch(next);
  };
}
