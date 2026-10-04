import { api } from "./api";

/**
 * The SWR fetcher every screen shares: the SWR key is the API path, relative to
 * `api`'s base URL (`/dashboard/stats`, `/inventory/low-stock?page=1`).
 *
 * Keyed on the path rather than on an opaque name so a mutation can revalidate
 * exactly what it changed with `mutate("/products")`, and so tests can answer a
 * request by its path through `SWRConfig` without mocking a module.
 */
export const fetcher = <T>(path: string): Promise<T> => api.get<T>(path).then((res) => res.data);

/** The message to show for a failed request: the API's own, when it sent one. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === "string") return response.data.message;
    if (error instanceof Error && error.message) return error.message;
  }
  return "Something went wrong.";
}
