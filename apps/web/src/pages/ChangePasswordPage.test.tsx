import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangePasswordPage from "./ChangePasswordPage";

const { api, navigate, authMock, sessionMock } = vi.hoisted(() => {
  const navigate = vi.fn();
  const api = { post: vi.fn() };
  const sessionMock = { refetch: vi.fn() };

  const authMock = {
    user: { username: "staff@acme.test", name: "Staff", mustChangePassword: true },
    status: "authenticated",
    refetchSession: vi.fn(),
  };

  return { api, navigate, authMock, sessionMock };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../lib/api", () => ({
  api,
  failureMessage: (_err: { message?: string }, fallback: string) => fallback,
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => sessionMock,
  },
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => authMock,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ChangePasswordPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  authMock.user = {
    username: "staff@acme.test",
    name: "Staff",
    mustChangePassword: true,
  };
  authMock.status = "authenticated";
  sessionMock.refetch.mockResolvedValue({});
  authMock.refetchSession.mockResolvedValue({});
});

describe("ChangePasswordPage", () => {
  it("renders all three password fields masked by default", () => {
    renderPage();

    const currentInput = screen.getByLabelText("Temporary password", { selector: "input" });
    const newInput = screen.getByLabelText("New password", { selector: "input" });
    const confirmInput = screen.getByLabelText("Confirm new password", { selector: "input" });

    expect(currentInput).toHaveAttribute("type", "password");
    expect(newInput).toHaveAttribute("type", "password");
    expect(confirmInput).toHaveAttribute("type", "password");
  });

  it("toggles password visibility with the see password button", async () => {
    const user = userEvent.setup();
    renderPage();

    const currentInput = screen.getByLabelText("Temporary password", { selector: "input" });

    const toggleCurrent = screen.getByRole("button", {
      name: /show temporary password/i,
    });

    await user.click(toggleCurrent);
    expect(currentInput).toHaveAttribute("type", "text");

    await user.click(
      screen.getByRole("button", { name: /hide temporary password/i })
    );
    expect(currentInput).toHaveAttribute("type", "password");
  });

  it("submits the password change and redirects to dashboard", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({});

    renderPage();

    await user.type(screen.getByLabelText("Temporary password", { selector: "input" }), "tempPass123");
    await user.type(screen.getByLabelText("New password", { selector: "input" }), "newPassword456");
    await user.type(screen.getByLabelText("Confirm new password", { selector: "input" }), "newPassword456");

    await user.click(screen.getByRole("button", { name: /save password/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/users/me/password", {
        currentPassword: "tempPass123",
        newPassword: "newPassword456",
      });
    });

    expect(sessionMock.refetch).toHaveBeenCalled();
    expect(authMock.refetchSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Temporary password", { selector: "input" }), "tempPass123");
    await user.type(screen.getByLabelText("New password", { selector: "input" }), "newPassword456");
    await user.type(screen.getByLabelText("Confirm new password", { selector: "input" }), "mismatch789");

    await user.click(screen.getByRole("button", { name: /save password/i }));

    expect(screen.getByText("The passwords do not match")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
