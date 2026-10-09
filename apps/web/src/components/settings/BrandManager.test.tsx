import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandManager } from "./BrandManager";

const { apiGet, apiPost, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  fetcher: apiGet,
  api: { get: apiGet, post: apiPost, put: apiPut, delete: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => _err?.message ?? fallback,
}));

const mockBrands = [
  { id: "b1", name: "Next Cola", shortCode: "NXC" },
  { id: "b2", name: "Sprite", shortCode: "SPR" },
];

const renderComponent = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <BrandManager />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockResolvedValue({ data: mockBrands });
});

describe("BrandManager (issue #45)", () => {
  it("renders brands list", async () => {
    renderComponent();

    expect(await screen.findByText("Next Cola")).toBeInTheDocument();
    expect(screen.getByText("NXC")).toBeInTheDocument();
    expect(screen.getByText("Sprite")).toBeInTheDocument();
  });

  it("creates a brand with name and shortCode", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText("Next Cola")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/brand name/i);
    const codeInput = screen.getByLabelText(/short code/i);
    const addButton = screen.getByRole("button", { name: /add brand/i });

    await user.type(nameInput, "Fanta");
    await user.type(codeInput, "FNT");
    await user.click(addButton);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/brands", {
        name: "Fanta",
        shortCode: "FNT",
      });
    });
  });

  it("renames a brand", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText("Next Cola")).toBeInTheDocument();

    const renameButton = screen.getByRole("button", { name: /rename next cola/i });
    await user.click(renameButton);

    const editNameInput = screen.getByLabelText(/edit brand name/i);
    await user.clear(editNameInput);
    await user.type(editNameInput, "Next Cola Classic");

    const saveButton = screen.getByRole("button", { name: /save brand/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith("/brands/b1", {
        name: "Next Cola Classic",
        shortCode: "NXC",
      });
    });
  });
});
