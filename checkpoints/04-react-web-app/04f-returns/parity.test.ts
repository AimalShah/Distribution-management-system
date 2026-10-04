// @vitest-environment jsdom
/**
 * Checkpoint 4f — Returns Pages: Parity Test
 *
 * The list and the new-return form. The form's one real rule comes from
 * `ReturnCreateSchema`: a SALE return names the sale, a PURCHASE return names
 * the purchase, and a write-off names neither. The screen goes one step
 * further and offers only the lines of the chosen document, at the price it
 * was transacted at, which is asserted here against the request body.
 *
 * The original stub was six empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReturnList from "../../../apps/web/src/pages/returns/ReturnList";
import ReturnForm from "../../../apps/web/src/pages/returns/ReturnForm";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const listRow = (overrides: Record<string, unknown> = {}) => ({
  id: "ret_1",
  returnCode: "RET-0001",
  returnType: "SALE",
  returnDate: "2026-10-02T00:00:00.000Z",
  reason: "Wrong flavour",
  user: { name: "Ann Owner", email: "ann@example.test" },
  _count: { items: 1 },
  ...overrides,
});

const water = { id: "prd_1", name: "Water", productCode: "SKU-1" };
const juice = { id: "prd_2", name: "Juice", productCode: "SKU-2" };

const formResponses = {
  "/sales": page([{ id: "sal_1", saleCode: "INV-0001", customer: { id: "cus_1", name: "Corner Store" } }]),
  "/sales/sal_1": { items: [{ productId: "prd_1", quantity: 6, unitPrice: 15, product: water }] },
  "/purchases": page([{ id: "pur_1", purchaseCode: "PO-0001", supplier: { id: "sup_1", companyName: "Acme" } }]),
  "/purchases/pur_1": { purchaseItems: [{ productId: "prd_2", quantity: 20, unitCost: 4, product: juice }] },
  "/products": page([
    { ...water, unitCost: 10, unitPrice: 15 },
    { ...juice, unitCost: 4, unitPrice: 6 },
  ]),
};

const renderForm = () =>
  renderWithApp(createElement(ReturnForm), { responses: formResponses, path: "/returns/new", route: "/returns/new" });

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: { id: "ret_new" } });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => vi.restoreAllMocks());

describe("Checkpoint 4f — returns list", () => {
  it("returns list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(ReturnList), {
      responses: {
        "/returns": (key: string) =>
          key.includes("page=2")
            ? page([listRow({ id: "ret_2", returnCode: "RET-0002", returnType: "DAMAGED", reason: null })], 2)
            : page([listRow()], 2),
      },
    });

    const row = (await screen.findByText("RET-0001")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 6).map((c) => c.textContent)).toEqual([
      "RET-0001",
      "Customer return",
      "Oct 02, 2026",
      "Wrong flavour",
      "1",
      "Ann Owner",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    const damaged = (await screen.findByText("RET-0002")).closest("tr")!;
    expect(within(damaged).getByText("Damaged write-off")).toBeTruthy();
    expect(calls).toContain("/returns?page=2&pageSize=20");
  });
});

describe("Checkpoint 4f — new return form", () => {
  it("return form validates required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Record return" }));

    expect(await screen.findByText("Please select the sale this return is reversing")).toBeTruthy();
    expect(screen.getByText("Please select a product")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("return form shows saleId field for SALE type", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(await screen.findByLabelText("Sale")).toBeTruthy();
    expect(screen.queryByLabelText("Purchase")).toBeNull();
    expect(screen.getByTestId("return-effect").textContent).toBe("Stock comes back in");

    // Lines come from the chosen sale, at the price it was sold for.
    await user.selectOptions(screen.getByLabelText("Sale"), await screen.findByRole("option", { name: /INV-0001/ }));
    const product = screen.getByLabelText("Product (item 1)");
    await within(product).findByRole("option", { name: "Water (6 on document)" });
    expect(within(product).queryByRole("option", { name: /Juice/ })).toBeNull();
    await user.selectOptions(product, "prd_1");
    expect(screen.getByLabelText<HTMLInputElement>("Unit price (item 1)").value).toBe("15");

    await user.type(screen.getByLabelText("Quantity (item 1)"), "9");
    expect(screen.getByText("Only 6 on the document")).toBeTruthy();
  });

  it("return form shows purchaseId field for PURCHASE type", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Return type"), "PURCHASE");

    expect(await screen.findByLabelText("Purchase")).toBeTruthy();
    expect(screen.queryByLabelText("Sale")).toBeNull();
    expect(screen.getByTestId("return-effect").textContent).toBe("Stock goes out");

    await user.selectOptions(screen.getByLabelText("Purchase"), await screen.findByRole("option", { name: /PO-0001/ }));
    const product = screen.getByLabelText("Product (item 1)");
    await within(product).findByRole("option", { name: "Juice (20 on document)" });
    await user.selectOptions(product, "prd_2");
    // Valued at what the supplier charged.
    expect(screen.getByLabelText<HTMLInputElement>("Unit price (item 1)").value).toBe("4");
  });

  it("a write-off names no document and offers any product", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Return type"), "DAMAGED");

    expect(screen.queryByLabelText("Sale")).toBeNull();
    expect(screen.queryByLabelText("Purchase")).toBeNull();
    const product = screen.getByLabelText("Product (item 1)");
    expect(await within(product).findByRole("option", { name: "Water" })).toBeTruthy();
    expect(within(product).getByRole("option", { name: "Juice" })).toBeTruthy();
  });

  it("return form adds/removes item rows", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByLabelText("Product (item 1)");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove item 1" }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getAllByTestId("return-item")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(screen.getAllByTestId("return-item")).toHaveLength(2);
  });

  it("return form submits correctly", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Sale"), await screen.findByRole("option", { name: /INV-0001/ }));
    const product = screen.getByLabelText("Product (item 1)");
    await within(product).findByRole("option", { name: /Water/ });
    await user.selectOptions(product, "prd_1");
    await user.type(screen.getByLabelText("Quantity (item 1)"), "2");
    const code = screen.getByLabelText("Return code");
    await user.clear(code);
    await user.type(code, "RET-TEST1");
    await user.type(screen.getByLabelText("Reason"), "Damaged in transit");
    await user.click(screen.getByRole("button", { name: "Record return" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/returns");
    expect(body).toMatchObject({
      returnCode: "RET-TEST1",
      returnType: "SALE",
      saleId: "sal_1",
      reason: "Damaged in transit",
      items: [{ productId: "prd_1", quantity: 2, unitPrice: 15, taxAmount: 0, discount: 0 }],
    });
    // The schema refuses a purchase reference on a SALE return, so none is sent.
    expect(body.purchaseId).toBeUndefined();
    expect(await screen.findByTestId("navigated-away")).toBeTruthy();
  });
});
