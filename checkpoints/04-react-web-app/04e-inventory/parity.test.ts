// @vitest-environment jsdom
/**
 * Checkpoint 4e — Inventory Page: Parity Test
 *
 * Both tabs, the adjust dialog and the rebuilt add-inventory form, rendered
 * through SWR and a router with the API answered by path. Writes go through
 * the real axios instance with its methods spied, so the assertions are on the
 * request bodies `InventoryCreateSchema` and `InventoryAdjustSchema` validate.
 *
 * The original stub was six empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Inventory from "../../../apps/web/src/pages/inventory/Inventory";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const inventoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: "inv_1",
  productId: "prd_1",
  quantityOnHand: 3,
  quantityReserved: 0,
  reorderLevel: 5,
  maxStockLevel: 100,
  product: { id: "prd_1", name: "Water", productCode: "SKU-1", unit: "pcs" },
  _count: { logs: 2 },
  ...overrides,
});

const logRow = (overrides: Record<string, unknown> = {}) => ({
  id: "log_1",
  movementType: "IN",
  quantity: 10,
  previousQty: 0,
  newQty: 10,
  reason: "Opening stock",
  reference: "PO-1",
  createdAt: "2026-10-01T09:00:00.000Z",
  product: { id: "prd_1", name: "Water", productCode: "SKU-1" },
  user: { name: "Ann Owner", email: "ann@example.test" },
  ...overrides,
});

const products = [
  { id: "prd_1", productCode: "SKU-1", name: "Water", isActive: true, inventory: { quantityOnHand: 3, reorderLevel: 5 } },
  { id: "prd_2", productCode: "SKU-2", name: "Juice", isActive: true, inventory: null },
];

const responses = (extra: Record<string, unknown> = {}) => ({
  "/inventory": page([inventoryRow()]),
  "/inventory/logs": page([logRow()]),
  "/products": page(products),
  ...extra,
});

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: {} });
});

afterEach(() => vi.restoreAllMocks());

describe("Checkpoint 4e — Inventory", () => {
  it("inventory tab renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(Inventory), {
      responses: responses({
        "/inventory": (key: string) =>
          key.includes("page=2")
            ? page([inventoryRow({ id: "inv_2", quantityOnHand: 50, product: { id: "prd_3", name: "Soda", productCode: "SKU-3", unit: "pcs" } })], 2)
            : page([inventoryRow()], 2),
      }),
    });

    const row = (await screen.findByText("Water")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 7).map((c) => c.textContent)).toEqual([
      "SKU-1",
      "Water",
      "3",
      "0",
      "5",
      "100",
      "Low",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    const soda = (await screen.findByText("Soda")).closest("tr")!;
    expect(within(soda).getByText("OK")).toBeTruthy();
    expect(calls).toContain("/inventory?page=2&pageSize=20");
  });

  it("tabs switch correctly", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(Inventory), { responses: responses() });

    await screen.findByText("Water");
    // The log tab is not fetched until it is opened.
    expect(calls.some((c) => c.startsWith("/inventory/logs"))).toBe(false);

    await user.click(screen.getByRole("tab", { name: "Movement Logs" }));

    expect(await screen.findByText("Opening stock")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Movement Logs" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("columnheader", { name: "On hand" })).toBeNull();
  });

  it("movement logs tab renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(Inventory), {
      responses: responses({
        "/inventory/logs": (key: string) =>
          key.includes("page=2")
            ? page([logRow({ id: "log_2", movementType: "OUT", quantity: 4, previousQty: 10, newQty: 6, reason: "Sale INV-1" })], 2)
            : page([logRow()], 2),
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Movement Logs" }));
    const row = (await screen.findByText("Opening stock")).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Oct 01, 2026",
      "Water",
      "IN",
      "10",
      "0 → 10",
      "Opening stock",
      "Ann Owner",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Sale INV-1")).toBeTruthy();
    expect(calls).toContain("/inventory/logs?page=2&pageSize=20");

    // Filtering by product asks the server, from page 1.
    await user.selectOptions(screen.getByLabelText("Product"), "prd_1");
    await waitFor(() => expect(calls).toContain("/inventory/logs?page=1&pageSize=20&productId=prd_1"));
  });

  it("adjust inventory dialog opens and submits", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(Inventory), { responses: responses() });

    await user.click(await screen.findByRole("button", { name: "Adjust Water" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("3 pcs on hand");

    await user.click(within(dialog).getByRole("button", { name: "Save adjustment" }));
    expect(await within(dialog).findByText("A reason is required")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    await user.selectOptions(within(dialog).getByLabelText("Movement"), "DAMAGED");
    await user.type(within(dialog).getByLabelText("Quantity"), "2");
    await user.type(within(dialog).getByLabelText("Reason"), "Crushed pallet");
    await user.click(within(dialog).getByRole("button", { name: "Save adjustment" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/inventory/adjust", {
        inventoryId: "inv_1",
        movementType: "DAMAGED",
        quantity: 2,
        reason: "Crushed pallet",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("labels a stock count as the counted quantity", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(Inventory), { responses: responses() });

    await user.click(await screen.findByRole("button", { name: "Adjust Water" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Movement"), "ADJUSTMENT");

    expect(within(dialog).getByLabelText("Counted quantity")).toBeTruthy();
    // Transfers are refused by the server, so they are not offered.
    expect(within(dialog).queryByRole("option", { name: /transfer/i })).toBeNull();
  });

  it("add inventory form validates correctly", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(Inventory), { responses: responses() });

    await user.click(await screen.findByRole("button", { name: "Add Inventory" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reorder level"), "-1");
    await user.click(within(dialog).getByRole("button", { name: "Add inventory" }));

    expect(await within(dialog).findByText("Please select a product")).toBeTruthy();
    expect(within(dialog).getByText("Reorder level must be zero or more")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("add inventory form submits correctly", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(Inventory), { responses: responses() });

    await user.click(await screen.findByRole("button", { name: "Add Inventory" }));
    const dialog = await screen.findByRole("dialog");
    // Only products without an inventory row are offered.
    const picker = within(dialog).getByLabelText("Product");
    await within(dialog).findByRole("option", { name: "Juice (SKU-2)" });
    expect(within(picker).queryByRole("option", { name: "Water (SKU-1)" })).toBeNull();

    await user.selectOptions(picker, "prd_2");
    await user.type(within(dialog).getByLabelText("Quantity on hand"), "24");
    await user.type(within(dialog).getByLabelText("Reorder level"), "6");
    await user.click(within(dialog).getByRole("button", { name: "Add inventory" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/inventory", {
        productId: "prd_2",
        quantityOnHand: 24,
        reorderLevel: 6,
        maxStockLevel: undefined,
        quantityReserved: undefined,
      })
    );
  });
});
