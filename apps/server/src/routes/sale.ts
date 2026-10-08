import { Router } from "express";
import {
  SaleInvoiceSchema,
  SaleUpdateSchema,
  paginationQuerySchema,
  saleListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
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

import { requireUserId } from "../middleware/auth-context";

import { renderSaleInvoiceHtml } from "../services/sale-invoice-template";
import { generateSalePdf } from "../services/sale-pdf";

export const saleRouter: Router = Router();

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

    const html = renderSaleInvoiceHtml(sale);
    res.type("html").send(html);
  })
);

saleRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const sale = await getSaleByIdOrCode(req.params.id, req.auth.organizationId);

    const pdf = await generateSalePdf(sale);
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
      const html = renderSaleInvoiceHtml(sale);

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
