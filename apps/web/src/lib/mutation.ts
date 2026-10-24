import { mutate as globalMutate } from "swr";
import { z } from "zod";
import { apiBaseUrl } from "./api";
import { AUTH_TOKEN_KEY } from "./auth-client";

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

const DOMAINS = [
  "sales", "payments", "purchases", "returns", "products", "categories", "brands",
  "suppliers", "customers", "inventory", "roles", "members", "dashboard", "reports",
] as const satisfies readonly Domain[];

const MutationEventSchema = z.object({
  domain: z.union([z.enum(DOMAINS), z.literal("all")]),
});

export type MutationEvent = z.infer<typeof MutationEventSchema>;

export const parseMutationEvent = (raw: string): MutationEvent | undefined => {
  try {
    const result = MutationEventSchema.safeParse(JSON.parse(raw));

    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

export const applyTenantMutation = (
  event: MutationEvent,
  handlers: { domain: (domain: Domain) => void; all: () => void } = {
    domain: invalidateDomains,
    all: invalidateEverything,
  }
): void => {
  if (event.domain === "all") {
    handlers.all();

    return;
  }

  handlers.domain(event.domain);
};

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
  categories: ["products", "reports"],
  brands: ["products", "reports"],
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

/**
 * Listen for writes made by another member of this organization. Fetch is used
 * instead of EventSource so Electron and bearer-token sessions can authenticate
 * the stream without putting a credential in its URL.
 */
export const startTenantMutationStream = (organizationId: string): (() => void) => {
  const controller = new AbortController();
  let closed = false;
  let reconnects = 0;

  const connect = async () => {
    while (!closed) {
      try {
        let token = "";

        try {
          token = localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
        } catch {
          // Cookie auth still works when storage is unavailable.
        }

        const headers = new Headers({
          Accept: "text/event-stream",
          "X-Organization-Id": organizationId,
        });

        if (token) headers.set("Authorization", `Bearer ${token}`);

        const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/events`, {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          window.dispatchEvent(new Event("dms:unauthorized"));

          return;
        }

        if (!response.ok || !response.body) {
          throw new Error(`Mutation stream failed with ${response.status}`);
        }

        if (reconnects > 0) invalidateEverything();

        reconnects = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
          let boundary = buffer.indexOf("\n\n");

          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const event = frame.split("\n").find((line) => line.startsWith("event: "));
            const data = frame.split("\n").find((line) => line.startsWith("data: "));

            if (event?.slice(7) === "mutation" && data) {
              try {
                const event = parseMutationEvent(data.slice(6));

                if (event) applyTenantMutation(event);
              } catch {
                // Ignore malformed frames; a reconnect refreshes active queries.
              }
            }

            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch {
        if (closed || controller.signal.aborted) return;
      }

      if (closed) return;
      reconnects += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnects - 1, 5));
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        controller.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
  };

  void connect();

  return () => {
    closed = true;
    controller.abort();
  };
};
