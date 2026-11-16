import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { OrderBookersTab } from "./OrderBookersTab";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const { api, fetcher } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  fetcher: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  api,
  fetcher,
  failureMessage: (_err: { message?: string }, fallback: string) =>
    _err?.message ?? fallback,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const bookerFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "ob_1",
  code: "OB-001",
  name: "John Booker",
  phone: "555-0199",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const renderTab = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <OrderBookersTab />
    </SWRConfig>
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetcher.mockResolvedValue({
    data: [bookerFixture()],
    total: 1,
    pageCount: 1,
  });
});

describe("OrderBookersTab (issue #51)", () => {
  it("renders order bookers list with code, name, phone, and active status", async () => {
    renderTab();

    expect(await screen.findByText("John Booker")).toBeInTheDocument();
    expect(screen.getByText("OB-001")).toBeInTheDocument();
    expect(screen.getByText("555-0199")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("opens add dialog and posts new order booker", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue(bookerFixture({ id: "ob_2", code: "OB-002", name: "Alice Booker" }));

    renderTab();
    await screen.findByText("John Booker");

    await user.click(screen.getByRole("button", { name: /add order booker/i }));

    expect(await screen.findByRole("heading", { name: "Add Order Booker" })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^code/i), "OB-002");
    await user.type(screen.getByLabelText(/^name/i), "Alice Booker");
    await user.type(screen.getByLabelText(/^phone/i), "555-8888");

    await user.click(screen.getByRole("button", { name: /save|create/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/order-bookers",
        expect.objectContaining({
          code: "OB-002",
          name: "Alice Booker",
          phone: "555-8888",
        })
      );
    });
  });

  it("toggles active status of an order booker", async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValue(bookerFixture({ isActive: false }));

    renderTab();
    await screen.findByText("John Booker");

    await user.click(screen.getByRole("button", { name: /deactivate/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        "/order-bookers/ob_1",
        expect.objectContaining({
          isActive: false,
        })
      );
    });
  });
});
