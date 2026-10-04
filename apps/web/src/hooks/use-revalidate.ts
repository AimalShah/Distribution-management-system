import { useCallback } from "react";
import { useSWRConfig } from "swr";

/**
 * Revalidate every cached request under an API path after a write:
 * `revalidate("/products")` refreshes `/products?page=1`, `/products/abc`, and
 * so on.
 *
 * Through `useSWRConfig` rather than SWR's global `mutate`, which only reaches
 * the default cache and would silently miss a provider-scoped one.
 */
export function useRevalidate() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (...prefixes: string[]) =>
      mutate(
        (key) => typeof key === "string" && prefixes.some((p) => key === p || key.startsWith(`${p}?`) || key.startsWith(`${p}/`)),
        undefined,
        { revalidate: true }
      ),
    [mutate]
  );
}
