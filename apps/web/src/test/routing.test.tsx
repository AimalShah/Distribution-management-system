import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

/**
 * The route table is the seam (issue #40). A sidebar link that points at a
 * path no `<Route>` serves renders an empty shell: the router matches nothing,
 * `<Outlet>` stays empty, and the user gets a blank white screen with no error
 * to chase. That failure is invisible to every other test here, so it gets its
 * own.
 *
 * The whole `App` is rendered rather than the page, because the defect lives in
 * the wiring between the sidebar's `to` and the router's `path` — asserting on
 * either half alone would pass while the other moved.
 */

type AuthState = "authenticated" | "anonymous";

const { apiGet, authStatus, activeOrgId } = vi.hoisted(() => {
  const initialOrgId: string | null = "org-1";
  const initialAuth: AuthState = "authenticated";

  return {
    apiGet: vi.fn(),
    authStatus: { current: initialAuth } as { current: AuthState },
    // SAFETY: container holds the active company context ID or null when in onboarding
    activeOrgId: { current: initialOrgId } as { current: string | null },
  };
});

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => fallback,
  RequestFailure: class RequestFailure extends Error {},
  isRequestFailure: () => false,
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: { username: "admin", name: "Admin" },
    status: authStatus.current,
    activeOrganizationId: activeOrgId.current,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// The shell pulls notifications and theme state on mount; none of it is what
// this seam is about, and letting it fetch would only add noise. It still has
// to render its `<Outlet>`, though — that outlet is what the routes nested
// under it land in, so returning `null` here would blank every page and the
// test would pass for the wrong reason.
vi.mock("../components/layout/AppShell", () => ({
  AppShell: () => <Outlet />,
}));

const emptyPage = { data: [], total: 0, pageCount: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  authStatus.current = "authenticated";
  activeOrgId.current = "org-1";
  apiGet.mockResolvedValue(emptyPage);
});

const renderAt = (path: string) =>
  render(
    // A fresh SWR cache per render. SWR's default cache is module-level and
    // dedupes by key, so without this the second test to visit the same route
    // reuses the first one's result and never fetches again — the assertion
    // would then depend on test order rather than on the route's behaviour.
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </SWRConfig>
  );

describe("unknown routes (issue #40)", () => {
  it("renders a not-found page instead of a blank screen", async () => {
    renderAt("/this-route-does-not-exist");

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it("offers a way back to a page that exists", async () => {
    renderAt("/this-route-does-not-exist");

    const back = await screen.findByRole("link", { name: /dashboard/i });

    expect(back).toHaveAttribute("href", "/");
  });
});

describe("the sidebar's Batches entry (issue #40)", () => {
  it("lands on a real page rather than a blank screen", async () => {
    renderAt("/inventory/batches");

    // The not-found page is the failure mode this guards against, so its
    // absence is half the assertion: reaching here at all means a route
    // matched instead of falling through to the catch-all.
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /batches/i })
    ).toBeInTheDocument();
  });

  it("asks the API for the batch list", async () => {
    renderAt("/inventory/batches");

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalled();
    });

    expect(String(apiGet.mock.calls[0][0])).toContain("/inventory/batches");
  });
});

describe("tenant onboarding route and guard", () => {
  it("renders the onboarding page directly at /onboarding", async () => {
    apiGet.mockResolvedValue([]);
    renderAt("/onboarding");

    expect(
      await screen.findByRole("heading", { name: /^welcome$/i })
    ).toBeInTheDocument();
  });

  it("redirects an authenticated user without an active organization to /onboarding", async () => {
    activeOrgId.current = null;
    apiGet.mockResolvedValue([]);
    renderAt("/");

    expect(
      await screen.findByRole("heading", { name: /^welcome$/i })
    ).toBeInTheDocument();
  });
});