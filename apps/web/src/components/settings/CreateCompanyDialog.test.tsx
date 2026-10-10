import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateCompanyDialog } from "./CreateCompanyDialog";

const { apiPost } = vi.hoisted(() => ({
  apiPost: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api: { post: apiPost },
  failureMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

describe("CreateCompanyDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog open and shows form inputs", () => {
    render(<CreateCompanyDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /create company/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/identifier \(slug\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gstin/i)).toBeInTheDocument();
  });

  it("auto-generates the slug from company name", async () => {
    const user = userEvent.setup();
    render(<CreateCompanyDialog open={true} onOpenChange={vi.fn()} />);

    const nameInput = screen.getByLabelText(/company name/i);
    await user.type(nameInput, "Alpha Beverage Ltd");

    const slugInput = screen.getByLabelText(/identifier \(slug\)/i);
    expect(slugInput).toHaveValue("alpha-beverage-ltd");
  });

  it("validates required fields before submitting", async () => {
    const user = userEvent.setup();
    render(<CreateCompanyDialog open={true} onOpenChange={vi.fn()} />);

    const submitBtn = screen.getByRole("button", { name: /create company/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("submits the form, activates the company, and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    apiPost
      .mockResolvedValueOnce({ id: "org_new", name: "Beta Supply", slug: "beta-supply" }) // POST /organizations
      .mockResolvedValueOnce({}); // POST /organizations/set-active

    render(
      <CreateCompanyDialog
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    );

    await user.type(screen.getByLabelText(/company name/i), "Beta Supply");
    await user.type(screen.getByLabelText(/address/i), "45 Industrial Zone");
    await user.type(screen.getByLabelText(/gstin/i), "27AAPFU0939F1ZV");

    const submitBtn = screen.getByRole("button", { name: /create company/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/organizations", {
        name: "Beta Supply",
        slug: "beta-supply",
        address: "45 Industrial Zone",
        gstin: "27AAPFU0939F1ZV",
      });
      expect(apiPost).toHaveBeenCalledWith("/organizations/set-active", {
        organizationId: "org_new",
      });
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "org_new", name: "Beta Supply" })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
