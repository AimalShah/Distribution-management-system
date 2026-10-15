/**
 * Simple in-memory TTL cache for server-side caching of expensive aggregates,
 * settings, and tenant lookups.
 *
 * In test mode (`NODE_ENV === 'test'`), caching is bypassed by default so unit
 * and integration tests testing database mocks always observe exact call counts.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    if (process.env.NODE_ENV === "test") return undefined;

    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (process.env.NODE_ENV === "test") return;

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const fresh = await factory();
    this.set(key, fresh, ttlMs);
    return fresh;
  }
}

export const serverCache = new MemoryCache();

export function buildCacheKey(
  scope: string,
  organizationId: string,
  metric?: string,
  params?: Record<string, unknown>
): string {
  const base = metric ? `${scope}:${organizationId}:${metric}` : `${scope}:${organizationId}`;
  if (!params || Object.keys(params).length === 0) {
    return base;
  }
  const parts = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : String(v)}`)
    .join("&");
  return parts ? `${base}:${parts}` : base;
}

export type TenantMetricScope = "sales" | "purchases" | "inventory" | "all";

export function invalidateTenantMetrics(
  organizationId: string,
  scope: TenantMetricScope = "all"
): void {
  // Clear dashboard stats when any financial/inventory metric changes
  serverCache.deletePrefix(`dashboard:${organizationId}`);

  if (scope === "all" || scope === "sales") {
    serverCache.deletePrefix(`reports:sales:${organizationId}`);
  }
  if (scope === "all" || scope === "purchases") {
    serverCache.deletePrefix(`reports:purchase:${organizationId}`);
  }
  if (scope === "all" || scope === "inventory" || scope === "sales" || scope === "purchases") {
    serverCache.deletePrefix(`reports:inventory:${organizationId}`);
    serverCache.deletePrefix(`inventory:low-stock:${organizationId}`);
  }
}

