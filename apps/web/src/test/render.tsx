import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SWRConfig } from "swr";

/** A response that never arrives, for asserting loading states. */
export const PENDING = Symbol("pending");

export type Responses = Record<string, unknown>;

/**
 * Answer an SWR key from `responses`: an exact match on the full key first,
 * then on the path without its query string. A value that is an `Error` is
 * thrown, so error states are tested through the same fetcher path the app
 * uses. An unanswered key fails loudly instead of rendering an empty page.
 */
export function fakeFetcher(responses: Responses, calls: string[] = []) {
  return async (key: string) => {
    calls.push(key);
    const value = key in responses ? responses[key] : responses[key.split("?")[0]];
    if (value === undefined) throw new Error(`No test response for ${key}`);
    if (value === PENDING) return new Promise(() => {});
    if (value instanceof Error) throw value;
    return typeof value === "function" ? (value as (k: string) => unknown)(key) : value;
  };
}

/**
 * Render a screen the way the app does -- SWR plus a router -- with the API
 * answered from `responses` instead of the network. A fresh SWR cache per
 * render, so no test sees another's data.
 */
export function renderWithApp(
  ui: ReactElement,
  {
    responses = {},
    path = "/",
    route = "*",
  }: { responses?: Responses; path?: string; route?: string } = {}
) {
  const calls: string[] = [];
  const result = render(
    <SWRConfig
      value={{
        fetcher: fakeFetcher(responses, calls),
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
      }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
          <Route path="*" element={<div data-testid="navigated-away" />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );
  return { ...result, calls };
}
