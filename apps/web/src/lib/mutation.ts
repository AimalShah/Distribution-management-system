import { mutate as globalMutate } from "swr";

/**
 * Instant updates: which cached queries a successful mutation makes stale, and
 * a helper that revalidates exactly those.
 *
 * Why this exists: the old flow only ever revalidated the key the mutating
 * component held (if it held one at all), so a recorded payment left the sale
 * list fresh but inventory, the customer's ledger, the dashboard's outstanding
 * figure and every sibling key caching the same resource stale until reload.
 * Rather than each page hand-picking keys (and missing the duplicates — the
 * same resource is cached under several differently-spelled keys), every
 * mutation names its domain and this module walks the whole cache, matching
 * keys by prefix pattern and revalidating every hit.
 *
 * The matchers are conservative on purpose: `/^\/sales(\?|$)/` matches the
 * list keys, and a payment surface's `/sales/customer/:id...` keys are part of
 * the payments domain's needs, handled by `ALONGSIDE`. A domain's own matcher
 * answers "the keys this domain's primary screen reads and writes"; the
 * cross-domain wiring lives in `ALONGSIDE` so it can be reasoned about in one
 * place rather than sprinkled over fifteen call-sites.
 */

export type Domain =
  | "sales"
  | "payments"
  | "purchases"
  | "returns"
  | "products"
  | "categories"
  | "brands"
  | "suppliers"
  | "customers"
  | "inventory"
  | "roles"
  | "members"
  | "dashboard"
  | "reports";

const MATCHERS: Record<Domain, RegExp> = {
  // Payments surface against an invoice row that is also cached under
  // `/sales/customer/:id...`; both live in whichever domain needs them fresh,
  // so the sales matcher must cover the customer-scoped invoice keys too.
  sales: /^\/sales(\?|$)|^\/sales\/customer\//,
  payments: /^\/payments(\?|$)/,
  purchases: /^\/purchases(\?|$)/,
  returns: /^\/returns(\?|$)/,
  products: /^\/products(\?|$)/,
  categories: /^\/categories(\?|$)/,
  brands: /^\/brands(\?|$)/,
  suppliers: /^\/suppliers(\?|$)/,
  customers: /^\/customers(\?|\/|$)/,
  // `/inventory/adjust` is the POST path itself; no query is ever cached on it.
  inventory: /^\/inventory(\/batches|\/logs|\/low-stock|\?|$)/,
  roles: /^\/roles(\?|$)/,
  members: /^\/members\/|^\/organizations\/.+\/(members|available-users)/,
  dashboard: /^\/dashboard(\/|\?|$)/,
  reports: /^\/reports(\/|\?|$)/,
};

/**
 * The cross-screen effects each kind of mutation carries, so callers never
 * have to remember them: a sale touches stock, what the customer owes and
 * every dashboard/report over the whole install; a return additionally puts
 * units back and credits the ledger; a purchase moves stock in; a payment
 * walks the invoice's total amountPaid and the customer's balance.
 */
const ALONGSIDE: Record<Domain, readonly Domain[]> = {
  sales: ["payments", "customers", "inventory", "dashboard", "reports"],
  payments: ["sales", "customers", "dashboard", "reports"],
  purchases: ["inventory", "dashboard", "reports"],
  returns: ["sales", "payments", "customers", "inventory", "dashboard", "reports"],
  products: [],
  categories: [],
  brands: [],
  suppliers: [],
  customers: [],
  inventory: [],
  roles: [],
  members: [],
  dashboard: [],
  reports: [],
};

const keyMatch =
  (domains: readonly Domain[]) =>
  (key: unknown): boolean =>
    keyMatchesDomains(key, domains);

/**
 * Whether a cache key belongs to any of the given domains, shared with the
 * tests. Returns false for non-string keys — SWR also supports key arrays and
 * functions, which this module does not address.
 */
export const keyMatchesDomains = (key: unknown, domains: readonly Domain[]): boolean =>
  typeof key === "string" &&
  domains.some((domain) => MATCHERS[domain].test(key));

/**
 * Revalidate every cached query one or more domains make stale. The cache
 * walked is the whole store, so differently-spelled sibling keys of one
 * resource (`/customers?page=1&...`, `/customers?pageSize=100`) are all hit.
 * Fire and forget: the mutation's own await has already returned success, and
 * revalidation races the user's next screen, not their form.
 */
export const invalidateDomains = (primary: Domain): void => {
  const unique = [...new Set([primary, ...ALONGSIDE[primary]])];

  void globalMutate(keyMatch(unique), undefined, { revalidate: true });
};

/**
 * The full-cache reset company switching needs (the previous tenant's rows are
 * keyed the same as the new tenant's — `activeOrganizationId` lives in the
 * session, not the key): revalidate every query.
 */
export const invalidateEverything = (): void => {
  void globalMutate(() => true, undefined, { revalidate: true });
};
