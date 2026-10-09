import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Batches } from "./Batches";

/**
 * The batch list at the `lib/api` seam (issue #40) — the same boundary the
 * other pages are tested at, so a transport swap does not rewrite these.
 *
 * Each render gets its own SWR cache: the default one is module-level and
 * dedupes by key, which would make the second test to visit a URL silently
 * reuse the first one's result.
 */

const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));

vi.mock("../../lib/api", () => ({
  fetcher,
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  failureMessage: (_err: { message?: string }, fallback: string) => fallback,
}));

/** The subset of a batch the list renders; a fixture may override any of it. */
type BatchOverrides = Partial<{
  id: string;
  batchNumber: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  expiryDate: string;
  receivedAt: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  product: { id: string; name: string; productCode: string; unit: string };
}>;

const batch = (overrides: BatchOverrides = {}) => ({
  id: "bat_1",
  batchNumber: "B-001",
  quantityReceived: 100,
  quantityRemaining: 40,
  unitCost: 12.5,
  expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  receivedAt: "2026-01-01T00:00:00.000Z",
  // Comfortably clear of the 30-day "near expiry" threshold, so this fixture
  // reads as plain Active stock; the near-expiry badge gets its own test.
  daysUntilExpiry: 120,
  isExpired: false,
  product: { id: "prod_1", name: "Widget", productCode: "PROD-001", unit: "pcs" },
  ...overrides,
});

type Batch = ReturnType<typeof batch>;

const page = (data: Batch[]) => ({ data, total: data.length, pageCount: 1 });

const renderBatches = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Batches />
    </SWRConfig>
  );

const requestedPaths = () => fetcher.mock.calls.map(([path]) => String(path));

/**
 * Radix's Select opens through pointer capture and measurement, neither of
 * which jsdom implements. Without these the dropdown silently stays closed and
 * every option lookup fails for reasons that have nothing to do with the code
 * under test.
 */
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;

  Element.prototype.setPointerCapture = () => {};

  Element.prototype.releasePointerCapture = () => {};

  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  fetcher.mockResolvedValue(page([batch()]));
});

describe("Batches list", () => {
  it("shows the batch number, product, remaining quantity, expiry and unit cost", async () => {
    renderBatches();

    expect(await screen.findByText("B-001")).toBeInTheDocument();
    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  // Money is PKR everywhere else in the app; this column was the one place
  // still printing a bare `$`, so a batch's cost read as another currency.
  it("renders unit cost as PKR, not a bare dollar sign", async () => {
    renderBatches();

    await screen.findByText("B-001");

    expect(screen.getByText(/Rs/)).toBeInTheDocument();
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });

  it("labels a lot that is already past its date", async () => {
    fetcher.mockResolvedValue(
      page([batch({ isExpired: true, daysUntilExpiry: -3 })])
    );

    renderBatches();

    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it("says so when there are no batches", async () => {
    fetcher.mockResolvedValue(page([]));

    renderBatches();

    expect(await screen.findByText(/no stock batches found/i)).toBeInTheDocument();
  });
});

describe("expiry window filter (issue #40)", () => {
  it("asks for a bounded window that excludes expired lots", async () => {
    const user = userEvent.setup();

    renderBatches();
    await screen.findByText("B-001");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /within 30 days/i }));

    await waitFor(() => {
      expect(requestedPaths().some((path) => path.includes("expiringWithinDays=30"))).toBe(true);
    });
  });

  it("offers expired lots as their own choice", async () => {
    const user = userEvent.setup();

    renderBatches();
    await screen.findByText("B-001");

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: /^expired$/i })).toBeInTheDocument();
  });
});

describe("search (issue #40)", () => {
  it("does not hit the API on every keystroke", async () => {
    const user = userEvent.setup();

    renderBatches();
    await screen.findByText("B-001");

    fetcher.mockClear();
    const box = screen.getByPlaceholderText(/search by batch/i);

    await user.type(box, "B-0");

    // A request per character would be one call per letter; the debounce means
    // the list is still untouched this soon after the last keypress.
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("searches once the typing settles", async () => {
    const user = userEvent.setup();

    renderBatches();
    await screen.findByText("B-001");

    fetcher.mockClear();
    await user.type(screen.getByPlaceholderText(/search by batch/i), "B-001");

    await waitFor(
      () => {
        expect(requestedPaths().some((path) => path.includes("search=B-001"))).toBe(true);
      },
      { timeout: 2000 }
    );
  });
});

describe("failure and loading states (issue #40)", () => {
  it("reports a failed request instead of showing an empty list", async () => {
    fetcher.mockRejectedValue(new Error("network down"));

    renderBatches();

    // Matched by heading rather than a loose /failed/ pattern: the panel's
    // body copy also says "failed", which would match two nodes.
    expect(
      await screen.findByRole("heading", { name: /could not load batches/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/no stock batches found/i)).not.toBeInTheDocument();
  });

  it("does not claim there are no batches while the request is in flight", async () => {
    fetcher.mockReturnValue(new Promise(() => {}));

    renderBatches();

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.queryByText(/no stock batches found/i)).not.toBeInTheDocument();
  });
});