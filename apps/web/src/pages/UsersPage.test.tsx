import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./UsersPage";

/**
 * The Team page at the `lib/api` seam (issue #41).
 *
 * The page was calling `/users`, which the server does not serve, and falling
 * back to a client-side list when the answer did not arrive. Every action on
 * this page therefore did nothing while looking like it worked. The real API is
 * membership-scoped: members are listed for an organization, someone is added
 * by choosing an account that already exists, a role is changed on its own
 * endpoint, and removal is by member id.
 */

const { api, fetcher, membership } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  fetcher: vi.fn(),
  membership: { current: { organizationId: "org_1" } as { organizationId: string } | null },
}));

vi.mock("../lib/api", () => ({
  api,
  fetcher,
  failureMessage: (_err: { message?: string }, fallback: string) =>
    _err?.message ?? fallback,
}));

vi.mock("../lib/profile", () => ({
  useActiveMembership: () => ({
    membership: membership.current,
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ORG = "org_1";

const member = (overrides: Record<string, unknown> = {}) => ({
  id: "mem_1",
  role: "member",
  createdAt: "2026-01-01T00:00:00.000Z",
  user: { id: "usr_1", name: "Ada Lovelace", email: "ada@acme.test", image: null },
  ...overrides,
});

/** Radix's Select needs pointer capture, which jsdom does not implement. */
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  membership.current = { organizationId: ORG };
  // The members endpoint answers with a bare array, not a paginated envelope.
  fetcher.mockResolvedValue([member()]);
});

describe("listing the team (issue #41)", () => {
  it("reads from the organization's members endpoint", async () => {
    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();

    expect(String(fetcher.mock.calls[0][0])).toBe(`/organizations/${ORG}/members`);
  });

  it("shows each member's role", async () => {
    renderPage();

    await screen.findByText("Ada Lovelace");

    // `member` is the stored value; the page shows the label a person reads.
    // Scoped to the row, because the dialog behind it offers the same label.
    const row = screen.getByText("Ada Lovelace").closest("tr");

    expect(row).toHaveTextContent("Member");
  });

  it("says so when the Company has no other members yet", async () => {
    fetcher.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no members/i)).toBeInTheDocument();
  });

  it("reports a failed request instead of showing an empty team", async () => {
    fetcher.mockRejectedValue(new Error("network down"));

    renderPage();

    expect(
      await screen.findByText(/could not load|couldn't load/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/no members/i)).not.toBeInTheDocument();
  });
});

describe("adding a member (issue #41)", () => {
  it("offers only accounts that can still be added", async () => {
    const user = userEvent.setup();

    api.get.mockResolvedValue([
      { id: "usr_9", name: "Grace Hopper", email: "grace@acme.test" },
    ]);

    renderPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/organizations/${ORG}/available-users`
      );
    });

    // The options only exist once the picker is open.
    await user.click(await screen.findByRole("combobox", { name: /user|account/i }));

    expect(await screen.findByRole("option", { name: /grace@acme.test/i })).toBeInTheDocument();
  });

  it("adds the chosen account with the chosen role", async () => {
    const user = userEvent.setup();

    api.get.mockResolvedValue([
      { id: "usr_9", name: "Grace Hopper", email: "grace@acme.test" },
    ]);
    api.post.mockResolvedValue(member());

    renderPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /add member/i }));

    const picker = await screen.findByRole("combobox", { name: /user|account/i });

    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: /grace@acme.test/i }));

    const submit = screen.getByRole("button", { name: /add|save|invite/i });

    await user.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(`/organizations/${ORG}/members`, {
        userId: "usr_9",
        role: "member",
      });
    });
  });
});

describe("changing a role (issue #41)", () => {
  it("patches the member's own role endpoint", async () => {
    const user = userEvent.setup();

    api.patch.mockResolvedValue(member({ role: "adminRole" }));

    renderPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /change role|edit/i }));

    const roleSelect = await screen.findByRole("combobox", { name: /role/i });

    await user.click(roleSelect);
    await user.click(await screen.findByRole("option", { name: /admin/i }));

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/members/mem_1/role", {
        role: "adminRole",
      });
    });
  });

  it("offers exactly the roles the server accepts", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /change role|edit/i }));

    await user.click(await screen.findByRole("combobox", { name: /role/i }));

    // The old dialog offered sales / inventory / manager, which the server's
    // memberRoleSchema does not accept.
    for (const role of ["Member", "Owner", "Administrator"]) {
      expect(
        await screen.findByRole("option", { name: new RegExp(role, "i") })
      ).toBeInTheDocument();
    }

    expect(
      screen.queryByRole("option", { name: /^sales$/i })
    ).not.toBeInTheDocument();
  });
});

describe("removing a member (issue #41)", () => {
  it("deletes by member id", async () => {
    const user = userEvent.setup();

    api.delete.mockResolvedValue({});

    renderPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /remove/i }));

    await user.click(await screen.findByRole("button", { name: /confirm|remove|yes/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/members/mem_1");
    });
  });
});