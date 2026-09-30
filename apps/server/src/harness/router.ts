import { Router } from "express";
import { getRecentQueries } from "@dms/db/debug-log";

/**
 * Debug / introspection harness.
 *
 * Two endpoints, both dev-only (see the `NODE_ENV` guard in `app.ts`):
 *
 *   GET  /__debug/state  -- recent Prisma queries from `@dms/db/debug-log`
 *   POST /__debug/call   -- invoke a service function by name and get JSON back
 *
 * `POST /__debug/call` resolves the target with a template literal
 * (`../services/${service}`), which is why the service name is validated before
 * the dynamic import. Without that check the import specifier is caller-shaped
 * input: `service: "../../../../etc/passwd"` or
 * `service: "product/../../../config/env"` reaches files outside `services/`,
 * and `fn` is read off the resulting module with no check that it is callable.
 *
 * The router is only mounted when `NODE_ENV !== "production"`, so this is a
 * development affordance rather than a production surface -- but "dev only" is
 * not an authorization control, and a developer machine holding a real database
 * connection string is exactly the target worth protecting. Hence the
 * allowlist-shaped validation rather than a `NODE_ENV` check alone.
 */

/** Path segments only: `supplier`, `product`, `reports/sales`. No traversal. */
const SERVICE_PATTERN = /^[a-z][a-zA-Z0-9]*(\/[a-z][a-zA-Z0-9]*)*$/;

/** JS identifiers only, so `fn` cannot reach an inherited or symbol key. */
const FUNCTION_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Upper bound on arguments, so a debugging aid is not a way to exhaust memory. */
const MAX_ARGS = 25;

/**
 * `constructor` and `prototype` pass a `typeof` check -- every object inherits
 * them, including module namespace objects -- and are callable. They are not
 * service functions.
 */
const isServiceFunctionName = (name: string) =>
  name !== "constructor" && name !== "prototype" && FUNCTION_PATTERN.test(name);

const isPlainFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const normalizeArgs = (args: unknown): unknown[] => {
  if (args === undefined || args === null) return [];
  if (!Array.isArray(args)) return [args];
  return args.slice(0, MAX_ARGS);
};

export const harnessRouter: Router = Router();

harnessRouter.get("/state", (_req, res) => {
  const queries = getRecentQueries();
  res.json({
    recentQueries: queries.slice(-50),
    queryCountLastMinute: queries.filter(
      (q) => Date.now() - new Date(q.at).getTime() < 60_000
    ).length,
  });
});

harnessRouter.post("/call", async (req, res) => {
  const { service, fn, args } = req.body ?? {};

  if (typeof service !== "string" || !SERVICE_PATTERN.test(service)) {
    res.status(400).json({ success: false, error: "Invalid service name" });
    return;
  }

  if (typeof fn !== "string" || !isServiceFunctionName(fn)) {
    res.status(400).json({ success: false, error: "Invalid function name" });
    return;
  }

  try {
    const mod = await import(`../services/${service}`);
    const target = (mod as Record<string, unknown>)[fn];

    if (!isPlainFunction(target)) {
      res.status(404).json({
        success: false,
        error: `services/${service} does not export a function "${fn}"`,
      });
      return;
    }

    res.json({ success: true, result: await target(...normalizeArgs(args)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});
