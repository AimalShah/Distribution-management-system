import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanySwitcher } from "./CompanySwitcher";

/** The Company switcher at the `lib/api` seam (issue #42). */

const org = (overrides: Record<string, unknown> = {}) => ({
  id: "org_a",
  name: "Acme Distribution",
  slug: "acme",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const orgB = () => org({ id: "org_b", name: "Beta Logistics", slug: "beta" });

/** Radix's DropdownMenu needs pointer capture, which jsdom does not implement. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

/** Mocks shared across all tests */
const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { name: "Test Owner", username: "owner@test.com" },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const activeMembership = {
  organizationId: "org_a",
  role: "owner",
  organizationName: "Acme Distribution",
};

vi.mock("../../lib/profile", () => ({
  useActiveMembership: () => ({
    membership: activeMembership,
    isLoading: false,
  }),
}));

const renderSwitcher = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <CompanySwitcher />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue([org(), orgB()]);
});

describe("CompanySwitcher", () => {
  it("renders the button and dropdown items", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    // The button is rendered with the active org name
    const button = await screen.findByRole("button", { name: /acme distribution/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    // The dropdown items show user's organizations
    expect(await screen.findByRole("menuitem", { name: /acme distribution/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /beta logistics/i })).toBeInTheDocument();
  });

  it("calls GET /api/organizations on mount", async () => {
    renderSwitcher();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/organizations");
    });
  });

  it("switches the active organization when one is clicked", async () => {
    const user = userEvent.setup();

    renderSwitcher();

    const button = await screen.findByRole("button", { name: /acme distribution/i });
    await user.click(button);

    await user.click(await screen.findByRole("menuitem", { name: /beta logistics/i }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/organizations/set-active", {
        organizationId: "org_b",
      });
    });
  });

  it("shows a loading skeleton while fetching", async () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    renderSwitcher();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error state when fetching fails", async () => {
    const user = userEvent.setup();
    apiGet.mockRejectedValue(new Error("network down"));

    renderSwitcher();

    const button = await screen.findByRole("button");
    await user.click(button);

    expect(await screen.findByText(/could not load|couldn't load/i)).toBeInTheDocument();
  });

  it("renders a create company button in the dropdown", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    const button = await screen.findByRole("button", { name: /acme distribution/i });
    await user.click(button);

    expect(
      await screen.findByRole("menuitem", { name: /create company|new company/i })
    ).toBeInTheDocument();
  });

  it("renders an edit company details button in the dropdown", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    const button = await screen.findByRole("button", { name: /acme distribution/i });
    await user.click(button);

    expect(
      await screen.findByRole("menuitem", { name: /edit company/i })
    ).toBeInTheDocument();
  });
});
