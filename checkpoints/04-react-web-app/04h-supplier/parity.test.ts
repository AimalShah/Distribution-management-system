// @vitest-environment jsdom
/**
 * Checkpoint 4h — Supplier Page: Parity Test
 *
 * List with pagination and server-side search, the shared add/edit dialog,
 * and confirmed delete, rendered through SWR and a router with the API
 * answered by path. Request bodies are asserted as `SupplierSchema` parses
 * them: blanks become `null`, which is what clears a column on edit.
 *
 * The original stub was four empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupplierList from "../../../apps/web/src/pages/suppliers/SupplierList";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const supplier = (overrides: Record<string, unknown> = {}) => ({
  id: "sup_1",
  supplierCode: "SUP-0001",
  companyName: "Acme Beverages",
  contactPerson: "Ann Supplier",
  email: "sales@acme.test",
  phone: "555-0199",
  address: "9 Dock Rd",
  city: "Shelbyville",
  isActive: true,
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: {} });
  vi.spyOn(api, "put").mockResolvedValue({ data: {} });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => vi.restoreAllMocks());

describe("Checkpoint 4h — Supplier page", () => {
  it("supplier list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(SupplierList), {
      responses: {
        "/suppliers": (key: string) =>
          key.includes("page=2")
            ? page([supplier({ id: "sup_2", companyName: "Bottle Co", email: null, isActive: false })], 2)
            : page([supplier()], 2),
      },
    });

    const row = (await screen.findByText("Acme Beverages")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 7).map((c) => c.textContent)).toEqual([
      "SUP-0001",
      "Acme Beverages",
      "Ann Supplier",
      "sales@acme.test",
      "555-0199",
      "Shelbyville",
      "Active",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    const bottle = (await screen.findByText("Bottle Co")).closest("tr")!;
    expect(within(bottle).getAllByRole("cell")[3].textContent).toBe("—");
    expect(within(bottle).getByText("Inactive")).toBeTruthy();
    expect(calls).toContain("/suppliers?page=2&pageSize=20");
  });

  it("searches on the server", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(SupplierList), { responses: { "/suppliers": page([supplier()]) } });
    await screen.findByText("Acme Beverages");

    await user.type(screen.getByRole("searchbox"), "ann");

    await waitFor(() => expect(calls).toContain("/suppliers?page=1&pageSize=20&search=ann"));
  });

  it("add supplier dialog opens and submits", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(SupplierList), { responses: { "/suppliers": page([]) } });

    await user.click(await screen.findByRole("button", { name: "Add Supplier" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Supplier code").value).toMatch(/^SUP-[A-Z0-9]{5}$/);

    await user.click(within(dialog).getByRole("button", { name: "Add supplier" }));
    expect(await within(dialog).findByText("Company name must be at least 2 characters")).toBeTruthy();
    expect(within(dialog).getByText("Contact person must be at least 2 characters")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("Company name"), "Bottle Co");
    await user.type(within(dialog).getByLabelText("Contact person"), "Bob");
    await user.type(within(dialog).getByLabelText("City"), "Capital City");
    await user.click(within(dialog).getByRole("button", { name: "Add supplier" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/suppliers");
    expect(body).toMatchObject({
      companyName: "Bottle Co",
      contactPerson: "Bob",
      city: "Capital City",
      email: null,
      phone: null,
      address: null,
      isActive: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("edit supplier loads data into dialog", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(SupplierList), { responses: { "/suppliers": page([supplier()]) } });

    await user.click(await screen.findByRole("button", { name: "Edit Acme Beverages" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Company name").value).toBe("Acme Beverages");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Contact person").value).toBe("Ann Supplier");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Email").value).toBe("sales@acme.test");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Address").value).toBe("9 Dock Rd");

    await user.clear(within(dialog).getByLabelText("Email"));
    await user.click(within(dialog).getByRole("switch"));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.put).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/suppliers/sup_1");
    expect(body).toMatchObject({ companyName: "Acme Beverages", email: null, isActive: false });
  });

  it("delete supplier removes from list", async () => {
    const user = userEvent.setup();
    let deleted = false;
    vi.mocked(api.delete).mockImplementation(async () => {
      deleted = true;
      return { data: undefined };
    });
    renderWithApp(createElement(SupplierList), {
      responses: { "/suppliers": () => (deleted ? page([]) : page([supplier()])) },
    });

    await user.click(await screen.findByRole("button", { name: "Delete Acme Beverages" }));
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(api.delete).toHaveBeenCalledWith("/suppliers/sup_1");
    expect(await screen.findByText("No suppliers yet.")).toBeTruthy();
  });
});
