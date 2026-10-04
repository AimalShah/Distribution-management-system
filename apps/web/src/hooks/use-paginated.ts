import { useState } from "react";
import useSWR from "swr";

/** The shape every list endpoint returns (`paginatedResponseSchema` in @dms/shared). */
export interface Paginated<T> {
  data: T[];
  pageCount: number;
  total: number;
}

export const PAGE_SIZE = 20;

/** `/products` + `{ page: 2, search: "" }` -> `/products?page=2&pageSize=20`. */
export function listPath(base: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Server-side pagination for a list endpoint. The page lives here rather than
 * in the URL because no screen links to page N of anything; search resets it,
 * since page 3 of a narrower result may not exist.
 */
export function usePaginated<T>(base: string, filters: Record<string, string | undefined> = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearchState] = useState("");
  const key = listPath(base, { page, pageSize: PAGE_SIZE, search, ...filters });
  const swr = useSWR<Paginated<T>>(key, { keepPreviousData: true });

  return {
    ...swr,
    key,
    page,
    setPage,
    search,
    setSearch: (value: string) => {
      setSearchState(value);
      setPage(1);
    },
  };
}
