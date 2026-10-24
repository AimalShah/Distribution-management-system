import type { RequestHandler } from "express";
import { publishTenantMutation, type MutationDomain } from "../utils/tenant-events";

const DOMAIN_BY_PATH = {
  sales: "sales",
  payments: "payments",
  purchases: "purchases",
  returns: "returns",
  products: "products",
  categories: "categories",
  brands: "brands",
  suppliers: "suppliers",
  customers: "customers",
  inventory: "inventory",
  roles: "roles",
  settings: "all",
} as const;

export function mutationDomainForPath(path: string): MutationDomain | undefined {
  const pathname = path.split("?", 1)[0];

  const match = /^\/api\/([^/]+)/.exec(pathname);

  if (!match) return undefined;

  if (match[1] === "users" || match[1] === "members") return "members";

  if (match[1] === "organizations") return "all";

  return Object.entries(DOMAIN_BY_PATH).find(([key]) => key === match[1])?.[1];
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Broadcast only successful authenticated writes, scoped to the active tenant. */
export const publishSuccessfulMutation: RequestHandler = (req, res, next) => {
  const domain = MUTATING_METHODS.has(req.method)
    ? mutationDomainForPath(req.originalUrl)
    : undefined;

  if (domain) {
    res.once("finish", () => {
      const organizationFromPath = /^\/api\/organizations\/([^/]+)/.exec(req.originalUrl)?.[1];
      const organizationId = req.auth?.organizationId || organizationFromPath;

      if (res.statusCode >= 200 && res.statusCode < 300 && organizationId) {
        publishTenantMutation(organizationId, domain);
      }
    });
  }

  next();
};
