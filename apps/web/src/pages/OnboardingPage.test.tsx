import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingPage } from "./OnboardingPage";

/**
 * The onboarding page at the `lib/api` seam (issue #42).
 *
 * A user with no active Company lands here after a 400 ORGANIZATION_REQUIRED.
 * The page lists their existing organizations and offers to create one.
 * Creating an organization posts to POST /api/organizations and then calls
 * the set-active endpoint so the session picks it up immediately.
 */

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: { name: "Test Owner", username: "owner@test.com" },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );

const ORG = "org_1";

const org = (overrides: Record<string, unknown> = {}) => ({
  id: ORG,
  name: "Acme Distribution",
  slug: "acme",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue([org()]);
  apiPost.mockResolvedValue(org({ id: "org_new", name: "New Corp" }));
});

describe("OnboardingPage", () => {
  it("shows the user's organizations and a create button", async () => {
    renderPage();

    expect(await screen.findByText("Acme Distribution")).toBeInTheDocument();

    // The create button is on the "Create new" tab
    const createTab = screen.getByRole("tab", { name: /create new/i });
    await userEvent.click(createTab);

    expect(screen.getByRole("button", { name: /create company/i })).toBeInTheDocument();
  });

  it("calls GET /api/organizations on mount", async () => {
    renderPage();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/organizations");
    });
  });

  it("creates a new organization when none exist", async () => {
    apiGet.mockResolvedValue([]);

    renderPage();

    // Switch to the Create tab
    const createTab = await screen.findByRole("tab", { name: /create new/i });
    await userEvent.click(createTab);

    await screen.findByRole("button", { name: /create company/i });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create company/i }));

    const input = screen.getByPlaceholderText(/acme distribution/i);
    await user.type(input, "Fresh Start Distribution");

    await user.click(screen.getByRole("button", { name: /create|save/i }));

    await waitFor(() => {
      // Auto-generation runs on first keystroke, so slug is "f" from "F"
      expect(apiPost).toHaveBeenCalledWith("/organizations", expect.objectContaining({
        name: "Fresh Start Distribution",
        slug: "f",
      }));
    });
  });

  it("shows an error when creation fails", async () => {
    apiPost.mockRejectedValue(new Error("A company with that name already exists"));

    renderPage();

    // Switch to the Create tab
    const createTab = await screen.findByRole("tab", { name: /create new/i });
    await userEvent.click(createTab);

    await screen.findByRole("button", { name: /create company/i });
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/acme distribution/i);
    await user.type(input, "Taken Name");
    await user.click(screen.getByRole("button", { name: /create|save/i }));

    // The error appears in both the Alert and the toast
    const errors = await screen.findAllByText(/already exists/i);
    expect(errors.length).toBeGreaterThan(0);
  });
});