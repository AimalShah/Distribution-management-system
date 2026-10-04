// @vitest-environment jsdom
/**
 * Checkpoint 4g — Customer Page: Parity Test
 *
 * List, server-side search, and the shared add/edit dialog, rendered through
 * SWR and a router with the API answered by path. The request bodies are the
 * point: blanks go out as blanks and `CustomerSchema` turns them into `null`
 * on the server, and a credit limit of 0 survives as 0 -- the legacy form
 * stored a 0 limit as "no limit".
 *
 * The original stub was five empty `it` blocks.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerSchema } from "@dms/shared";
import CustomerList from "../../../apps/web/src/pages/customers/CustomerList";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const customer = (overrides: Record<string, unknown> = {}) => ({
  id: "cus_1",
  customerCode: "CUST-0001",
  name: "Corner Store",
  email: "orders@corner.test",
  phone: "555-0100",
  address: "1 Main St",
  city: "Springfield",
  creditLimit: 0,
  isActive: true,
  ...overrides,
});

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: {} });
  vi.spyOn(api, "put").mockResolvedValue({ data: {} });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => vi.restoreAllMocks());

describe("Checkpoint 4g — Customer page", () => {
  it("customer list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(CustomerList), {
      responses: {
        "/customers": (key: string) =>
          key.includes("page=2")
            ? page([customer({ id: "cus_2", name: "Mega Mart", creditLimit: null, isActive: false })], 2)
            : page([customer()], 2),
      },
    });

    const row = (await screen.findByText("Corner Store")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 7).map((c) => c.textContent)).toEqual([
      "CUST-0001",
      "Corner Store",
      "orders@corner.test",
      "555-0100",
      "Springfield",
      // A recorded zero is "no credit", not "no limit recorded".
      "$0.00",
      "Active",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    const mega = (await screen.findByText("Mega Mart")).closest("tr")!;
    expect(within(mega).getAllByRole("cell")[5].textContent).toBe("—");
    expect(within(mega).getByText("Inactive")).toBeTruthy();
    expect(calls).toContain("/customers?page=2&pageSize=20");
  });

  it("customer search filters results", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(CustomerList), {
      responses: {
        "/customers": (key: string) =>
          key.includes("search=mega") ? page([customer({ id: "cus_2", name: "Mega Mart" })]) : page([customer()]),
      },
    });
    await screen.findByText("Corner Store");

    await user.type(screen.getByRole("searchbox"), "mega");

    expect(await screen.findByText("Mega Mart")).toBeTruthy();
    expect(screen.queryByText("Corner Store")).toBeNull();
    expect(calls).toContain("/customers?page=1&pageSize=20&search=mega");
  });

  it("add customer dialog opens and submits", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(CustomerList), { responses: { "/customers": page([]) } });

    await user.click(await screen.findByRole("button", { name: "Add Customer" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Customer code").value).toMatch(/^CUST-[A-Z0-9]{5}$/);

    await user.click(within(dialog).getByRole("button", { name: "Add customer" }));
    expect(await within(dialog).findByText("Name is required")).toBeTruthy();

    await user.type(within(dialog).getByLabelText("Name"), "Mega Mart");
    await user.type(within(dialog).getByLabelText("Email"), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Add customer" }));
    expect(await within(dialog).findByText("Enter a valid email address")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Email"));
    await user.type(within(dialog).getByLabelText("Credit limit"), "2500");
    await user.click(within(dialog).getByRole("button", { name: "Add customer" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/customers");
    expect(body).toMatchObject({ name: "Mega Mart", creditLimit: 2500, isActive: true, email: null, phone: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("edit customer loads data into dialog", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(CustomerList), { responses: { "/customers": page([customer()]) } });

    await user.click(await screen.findByRole("button", { name: "Edit Corner Store" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Name").value).toBe("Corner Store");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Customer code").value).toBe("CUST-0001");
    expect(within(dialog).getByLabelText<HTMLInputElement>("City").value).toBe("Springfield");
    expect(within(dialog).getByLabelText<HTMLInputElement>("Credit limit").value).toBe("0");

    // Clearing a field clears the column, rather than keeping the old value.
    await user.clear(within(dialog).getByLabelText("Phone"));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.put).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/customers/cus_1");
    expect(body).toMatchObject({ name: "Corner Store", phone: null, creditLimit: 0 });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("delete customer removes from list", async () => {
    const user = userEvent.setup();
    let deleted = false;
    vi.mocked(api.delete).mockImplementation(async () => {
      deleted = true;
      return { data: undefined };
    });
    renderWithApp(createElement(CustomerList), {
      responses: { "/customers": () => (deleted ? page([]) : page([customer()])) },
    });

    await user.click(await screen.findByRole("button", { name: "Delete Corner Store" }));
    expect(api.delete).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(api.delete).toHaveBeenCalledWith("/customers/cus_1");
    expect(await screen.findByText("No customers yet.")).toBeTruthy();
  });

  it("the form's blanks are what the server schema expects", () => {
    // The dialog submits the parsed output, so this is the contract it relies on.
    const parsed = CustomerSchema.parse({ customerCode: "C-1", name: "X", email: "", phone: "  ", creditLimit: "" });
    expect(parsed).toMatchObject({ email: null, phone: null, creditLimit: null, isActive: true });
  });
});
