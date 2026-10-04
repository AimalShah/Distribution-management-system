// @vitest-environment jsdom
/**
 * Checkpoint 4d — Sale Invoice Pages: Parity Test
 *
 * The screens (list, new invoice with dynamic lines and live totals) render
 * through SWR and a router with the API answered by path. Print and PDF run for
 * real: the invoice HTML comes from the server against a seeded database, and
 * the PDF is printed by an installed Chrome/Edge through `puppeteer-core` --
 * GitHub's `ubuntu-latest` image ships Chrome, so CI runs it too.
 *
 * The original stub was seven empty `it` blocks.
 */
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { calculateSaleTotal } from "@dms/shared";
import SaleInvoiceList from "../../../apps/web/src/pages/sales/SaleInvoiceList";
import SaleInvoiceForm from "../../../apps/web/src/pages/sales/SaleInvoiceForm";
import { api } from "../../../apps/web/src/lib/api";
import { renderWithApp } from "../../../apps/web/src/test/render";
import { findBrowser } from "../../../apps/server/src/invoices/pdf";
import {
  app,
  asOrg,
  asUser,
  hasDatabase,
  prisma,
  request,
  seedTenants,
  teardownTenants,
  unique,
  type Tenant,
} from "../../support/parity-db";

const page = <T>(data: T[], pageCount = 1) => ({ data, pageCount, total: data.length });

const customer = { id: "cus_1", customerCode: "C-1", name: "Corner Store" };
const products = [
  { id: "prd_1", productCode: "SKU-1", name: "Water", unitCost: 10, unitPrice: 15, isActive: true, inventory: { quantityOnHand: 40, reorderLevel: 5 } },
  { id: "prd_2", productCode: "SKU-2", name: "Juice", unitCost: 4, unitPrice: 6.5, isActive: true, inventory: { quantityOnHand: 2, reorderLevel: 5 } },
];

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "sal_1",
  saleCode: "INV-0001",
  saleDate: "2026-10-03T00:00:00.000Z",
  status: "Completed",
  totalAmount: 99.5,
  customer,
  _count: { items: 2 },
  ...overrides,
});

const renderForm = () =>
  renderWithApp(createElement(SaleInvoiceForm), {
    responses: { "/customers": page([customer]), "/products": page(products) },
    path: "/sale-invoice/new",
    route: "/sale-invoice/new",
  });

beforeEach(() => {
  vi.spyOn(api, "post").mockResolvedValue({ data: { id: "sal_new" } });
  vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });
});

afterEach(() => vi.restoreAllMocks());

describe("Checkpoint 4d — invoice list", () => {
  it("sale invoice list renders with pagination", async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApp(createElement(SaleInvoiceList), {
      responses: {
        "/sales": (key: string) =>
          key.includes("page=2") ? page([row({ id: "sal_2", saleCode: "INV-0002" })], 2) : page([row()], 2),
      },
    });

    const tr = (await screen.findByText("INV-0001")).closest("tr")!;
    expect(within(tr).getAllByRole("cell").slice(0, 6).map((c) => c.textContent)).toEqual([
      "INV-0001",
      "Corner Store",
      "Oct 03, 2026",
      "Completed",
      "2",
      "$99.50",
    ]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("INV-0002")).toBeTruthy();
    expect(calls).toContain("/sales?page=2&pageSize=20");
  });

  it("print fetches the invoice through the authenticated client", async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: "<html>invoice</html>" });
    const open = vi.spyOn(window, "open").mockReturnValue({ location: { href: "" } } as unknown as Window);
    URL.createObjectURL = vi.fn(() => "blob:invoice");
    renderWithApp(createElement(SaleInvoiceList), { responses: { "/sales": page([row()]) } });

    await user.click(await screen.findByRole("button", { name: "Print INV-0001" }));

    await waitFor(() => expect(get).toHaveBeenCalledWith("/sales/sal_1/print", { responseType: "text" }));
    expect(open).toHaveBeenCalled();
  });
});

describe("Checkpoint 4d — new invoice form", () => {
  it("sale invoice form validates required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Create invoice" }));

    expect(await screen.findByText("Please select a customer")).toBeTruthy();
    expect(screen.getByText("Please select a product")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sale invoice form adds/removes item rows", async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByLabelText("Product (item 1)");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Remove item 1" }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getAllByTestId("sale-item")).toHaveLength(2);
    await user.type(screen.getByLabelText("Quantity (item 2)"), "4");
    await user.click(screen.getByRole("button", { name: "Remove item 1" }));

    expect(screen.getAllByTestId("sale-item")).toHaveLength(1);
    expect(screen.getByLabelText<HTMLInputElement>("Quantity (item 1)").value).toBe("4");
  });

  it("sale invoice form calculates totals correctly", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Product (item 1)"), await screen.findByRole("option", { name: /Water/ }));
    expect(screen.getByLabelText<HTMLInputElement>("Unit price (item 1)").value).toBe("15");
    await user.type(screen.getByLabelText("Quantity (item 1)"), "3");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.selectOptions(screen.getByLabelText("Product (item 2)"), "prd_2");
    await user.type(screen.getByLabelText("Quantity (item 2)"), "2");
    // Line tax is stored but is not part of the sale total (see totals.ts).
    await user.type(screen.getByLabelText("Tax % (item 2)"), "50");
    await user.type(screen.getByLabelText("Discount"), "5");
    await user.type(screen.getByLabelText("Tax amount"), "2.25");

    const expected = calculateSaleTotal({
      items: [
        { quantity: 3, unitPrice: 15 },
        { quantity: 2, unitPrice: 6.5 },
      ],
      discount: 5,
      taxAmount: 2.25,
    });
    expect(expected).toBe(55.25);
    expect(screen.getAllByTestId("line-total").map((el) => el.textContent)).toEqual(["$45.00", "$13.00"]);
    expect(screen.getByTestId("subtotal").textContent).toBe("$58.00");
    expect(screen.getByTestId("grand-total").textContent).toBe("$55.25");
  });

  it("warns before submit when a line asks for more than is in stock", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Product (item 1)"), await screen.findByRole("option", { name: /Juice/ }));
    await user.type(screen.getByLabelText("Quantity (item 1)"), "5");

    expect(screen.getByText("Only 2 in stock")).toBeTruthy();
  });

  it("sale invoice form submits correctly", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(await screen.findByLabelText("Customer"), await screen.findByRole("option", { name: "Corner Store" }));
    const code = screen.getByLabelText("Invoice code");
    await user.clear(code);
    await user.type(code, "INV-TEST1");
    await user.selectOptions(screen.getByLabelText("Status"), "Completed");
    await user.selectOptions(screen.getByLabelText("Product (item 1)"), await screen.findByRole("option", { name: /Water/ }));
    await user.type(screen.getByLabelText("Quantity (item 1)"), "3");
    await user.click(screen.getByRole("button", { name: "Create invoice" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/sales");
    expect(body).toMatchObject({
      saleCode: "INV-TEST1",
      customerId: "cus_1",
      status: "Completed",
      items: [{ productId: "prd_1", quantity: 3, unitPrice: 15 }],
    });
    expect(await screen.findByTestId("navigated-away")).toBeTruthy();
  });
});

describe.skipIf(!hasDatabase)("Checkpoint 4d — invoice print and PDF", () => {
  let t: Tenant;
  let saleId: string;
  let saleCode: string;

  beforeAll(async () => {
    t = await seedTenants();
    await prisma.inventory.create({
      data: { organizationId: t.organizationId, productId: t.productId, quantityOnHand: 50, reorderLevel: 5 },
    });
    saleCode = unique("INV");
    const res = await request(app)
      .post("/api/sales")
      .set(asUser(t.organizationId, t.userId))
      .send({
        saleCode,
        customerId: t.customerId,
        status: "Completed",
        discount: 5,
        items: [{ productId: t.productId, quantity: 4, unitPrice: 12.5 }],
      });
    expect(res.status).toBe(201);
    saleId = res.body.id;
  });

  afterAll(async () => {
    if (t) await teardownTenants(t);
  });

  it("invoice print view renders correctly", async () => {
    const res = await request(app).get(`/api/sales/${saleId}/print`).set(asOrg(t.organizationId));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const doc = new DOMParser().parseFromString(res.text, "text/html");
    expect(doc.title).toBe(`Invoice ${saleCode}`);
    expect(doc.body.textContent).toContain("Parity Customer");
    expect(doc.body.textContent).toContain("Parity Product");
    const totals = [...doc.querySelectorAll("table.totals tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent).join(" ")
    );
    expect(totals).toEqual(["Subtotal $50.00", "Discount -$5.00", "Total $45.00"]);
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });

  it("another tenant cannot print the invoice", async () => {
    const res = await request(app).get(`/api/sales/${saleId}/print`).set(asOrg(t.otherOrganizationId));

    expect(res.status).toBe(404);
  });

  it.skipIf(!findBrowser())(
    "invoice PDF generation works",
    async () => {
      const res = await request(app)
        .get(`/api/sales/${saleId}/pdf`)
        .set(asOrg(t.organizationId))
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on("data", (c: Buffer) => chunks.push(c));
          response.on("end", () => done(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain(`invoice-${saleId}.pdf`);
      const pdf = res.body as Buffer;
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1000);
    },
    60_000
  );
});
