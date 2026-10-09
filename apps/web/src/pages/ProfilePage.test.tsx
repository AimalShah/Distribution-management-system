import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { APIError } from "better-call";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

/**
 * The profile page at the better-auth client seam (issue #43).
 *
 * The page used to invent its contents: a hardcoded name, email, phone and
 * city, and a password form that waited 300ms and reported success without ever
 * calling anything. The two facts worth protecting here are that the page shows
 * what the session actually says, and that both forms reach the real endpoint
 * and surface what it says back.
 */

const { session, activeMember, fullOrganization, updateUser, changePassword } =
  vi.hoisted(() => ({
    // SAFETY: each holder is written only by `beforeEach` and the tests, and is
    // read only by the mocked client, so the declared shape is the whole
    // contract between them.
    session: { current: null } as { current: { user: { name: string; email: string } } | null },
    activeMember: { current: null } as { current: { role: string } | null },
    fullOrganization: { current: null } as { current: { name: string } | null },
    updateUser: vi.fn(),
    changePassword: vi.fn(),
  }));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session.current, isPending: false, error: null }),
    updateUser,
    changePassword,
    organization: {
      // better-auth's client resolves to `{ data, error }` rather than
      // throwing, so the mock answers in the same shape the real one does.
      getActiveMember: vi.fn(async () => ({
        data: activeMember.current,
        error: null,
      })),
      getFullOrganization: vi.fn(async () => ({
        // The real endpoint spreads the organization's fields at the top level
        // next to `members`/`invitations`; the mock matches that shape.
        data: fullOrganization.current,
        error: null,
      })),
    },
  },
  signOut: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    user: session.current
      ? { name: session.current.user.name, username: session.current.user.email }
      : null,
    status: session.current ? "authenticated" : "anonymous",
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();

  session.current = {
    user: { name: "Ada Lovelace", email: "ada@acme.test" },
  };
  activeMember.current = { role: "owner" };
  fullOrganization.current = { name: "Acme Distribution" };

  updateUser.mockResolvedValue({ status: true });
  changePassword.mockResolvedValue({ status: true });
});

/**
 * The real client rejects with an `APIError`, which is an `Error` carrying the
 * server's message. Mocking anything else would let the page pass by reading a
 * plain object, which is not what it will meet in production.
 */
const refusal = (message: string) =>
  new APIError("BAD_REQUEST", { message, status: 400 });

describe("what the profile shows (issue #43)", () => {
  it("shows the name and email the session carries", async () => {
    renderPage();

    expect(await screen.findAllByText("Ada Lovelace")).not.toHaveLength(0);
    expect(screen.getAllByText("ada@acme.test")).not.toHaveLength(0);
  });

  it("shows the caller's role and active Company", async () => {
    renderPage();

    expect(await screen.findByText("owner")).toBeInTheDocument();
    expect(screen.getByText("Acme Distribution")).toBeInTheDocument();
  });

  // The old page showed a phone number and a city. `User` has neither column,
  // so there was nothing behind them to show.
  it("shows no phone or location, because the system stores neither", async () => {
    renderPage();

    await screen.findAllByText("Ada Lovelace");

    expect(screen.queryByText(/\+1 \(555\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chicago/)).not.toBeInTheDocument();
    expect(screen.queryByText("+1 (555) 234-5678")).not.toBeInTheDocument();
  });
});

describe("changing the display name (issue #43)", () => {
  it("sends the new name to the auth API", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findAllByText("Ada Lovelace");

    const field = screen.getByLabelText(/display name/i);

    await user.clear(field);
    await user.type(field, "Ada King");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ name: "Ada King" });
    });
  });

  it("reports a refusal instead of claiming the change worked", async () => {
    const user = userEvent.setup();

    updateUser.mockRejectedValue(refusal("You cannot change your own name"));

    renderPage();
    await screen.findAllByText("Ada Lovelace");

    const field = screen.getByLabelText(/display name/i);

    await user.clear(field);
    await user.type(field, "Ada King");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText("You cannot change your own name")
    ).toBeInTheDocument();
  });
});

describe("changing the password (issue #43)", () => {
  const fillPasswords = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/current password/i), "OldPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "NewPass456!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass456!");
  };

  it("calls the real password endpoint", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findAllByText("Ada Lovelace");

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "OldPass123!",
        newPassword: "NewPass456!",
        revokeOtherSessions: true,
      });
    });
  });

  it("refuses mismatched passwords without calling the API", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findAllByText("Ada Lovelace");

    await user.type(screen.getByLabelText(/current password/i), "OldPass123!");
    await user.type(screen.getByLabelText(/^new password/i), "NewPass456!");
    await user.type(screen.getByLabelText(/confirm password/i), "Different789!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("surfaces the server's refusal when the current password is wrong", async () => {
    const user = userEvent.setup();

    changePassword.mockRejectedValue(refusal("Invalid password"));

    renderPage();
    await screen.findAllByText("Ada Lovelace");

    await fillPasswords(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText("Invalid password")).toBeInTheDocument();
  });
});