import { Router } from "express";
import {
  SaleInvoiceSchema,
  SaleUpdateSchema,
  paginationQuerySchema,
  saleListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import { forbidden } from "../http/errors";
import {
  cancelSale,
  createSale,
  deleteSale,
  getSaleByIdOrCode,
  getSaleInvoiceData,
  getSales,
  getSalesByCustomer,
  restoreSale,
  uncancelSale,
  updateSale,
} from "../services/sale";
import { checkPermission } from "../services/rbac";

import { requireUserId } from "../middleware/auth-context";

import { renderSaleInvoiceHtml } from "../services/sale-invoice-template";
import { generateSalePdf } from "../services/sale-pdf";
import { getCompanySettings } from "../services/settings";

export const saleRouter: Router = Router();

/**
 * Hydrate an invoice with the active Company's document profile (issue #39) so
 * the header prints the issuer the client configured rather than a hardcoded
 * title. The settings read is scoped to the same tenant the invoice came from.
 */
async function withCompany<T extends object>(sale: T, organizationId: string) {
  const settings = await getCompanySettings(organizationId);

  return {
    ...sale,
    company: {
      name: settings.displayName,
      address: settings.address,
      gstin: settings.gstin,
    },
  };
}

saleRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = saleListQuerySchema.parse(req.query);

    const result = await getSales({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

// Registered before `/:id` so the literal segment always wins.
saleRouter.get(
  "/customer/:customerId",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationQuerySchema.parse(req.query);

    const result = await getSalesByCustomer({
      customerId: req.params.customerId,
      organizationId: req.auth.organizationId,
      page,
      pageSize,
    });

    res.json(result);
  })
);

saleRouter.get(
  "/:id/print",
  asyncHandler(async (req, res) => {
    const sale = await getSaleByIdOrCode(req.params.id, req.auth.organizationId);

    const html = renderSaleInvoiceHtml(await withCompany(sale, req.auth.organizationId));
    res.type("html").send(html);
  })
);

saleRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const sale = await getSaleByIdOrCode(req.params.id, req.auth.organizationId);

    const pdf = await generateSalePdf(await withCompany(sale, req.auth.organizationId));
    res
      .type("pdf")
      .set("Content-Disposition", `inline; filename="invoice-${sale.saleCode}.pdf"`)
      .send(Buffer.from(pdf));
  })
);

saleRouter.get(
  "/:id/invoice",
  asyncHandler(async (req, res) => {
    const sale = await getSaleInvoiceData(req.params.id, req.auth.organizationId);

    if (req.accepts("html") && !req.accepts("json")) {
      const html = renderSaleInvoiceHtml(await withCompany(sale, req.auth.organizationId));

      return res.type("html").send(html);
    }

    res.json(sale);
  })
);

saleRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await getSaleByIdOrCode(req.params.id, req.auth.organizationId);

    res.json(sale);
  })
);

saleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = SaleInvoiceSchema.parse(req.body);

    // Every stock movement is written to `InventoryLog`, whose `userId` is
    // required, so the caller has to say who they are.
    const userId = requireUserId(req.auth.userId);

    // The flag only *asks* to override; whether this caller may is decided here
    // and never by the body (ADR 0005). A caller that cannot is refused before
    // any credit-limit arithmetic runs.
    if (data.overrideCreditLimit) {
      const allowed = await checkPermission(
        userId,
        req.auth.organizationId,
        "sales",
        "override_credit_limit"
      );

      if (!allowed) {
        throw forbidden(
          "You do not have permission to override a customer's credit limit",
          "CREDIT_LIMIT_OVERRIDE_FORBIDDEN"
        );
      }
    }

    const sale = await createSale(data, req.auth.organizationId, userId);

    res.status(201).json(sale);
  })
);

saleRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = SaleUpdateSchema.parse(req.body);
    const sale = await updateSale(req.params.id, data, req.auth.organizationId);
    res.json(sale);
  })
);

saleRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // A delete reverses the stock the invoice consumed, so it writes ledger rows
    // and needs attribution for the same reason the create does.
    const userId = requireUserId(req.auth.userId);

    const deleted = await deleteSale(req.params.id, req.auth.organizationId, userId);
    res.json(deleted);
  })
);

saleRouter.post(
  "/:id/restore",
  asyncHandler(async (req, res) => {
    // A restore re-consumes the stock the delete gave back — same ledger, same
    // attribution requirement.
    const userId = requireUserId(req.auth.userId);

    const restored = await restoreSale(req.params.id, req.auth.organizationId, userId);
    res.json(restored);
  })
);

// Cancel and un-cancel move no stock and write no ledger rows, so unlike the
// two above they need no user attribution.
saleRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const cancelled = await cancelSale(req.params.id, req.auth.organizationId);
    res.json(cancelled);
  })
);

saleRouter.post(
  "/:id/uncancel",
  asyncHandler(async (req, res) => {
    const restored = await uncancelSale(req.params.id, req.auth.organizationId);
    res.json(restored);
  })
);
