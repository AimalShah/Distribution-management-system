import { Router } from "express";
import {
  SaleInvoiceSchema,
  SaleUpdateSchema,
  paginationQuerySchema,
  saleListQuerySchema,
} from "@dms/shared";
import prisma from "@dms/db";
import { asyncHandler, badRequest, HttpError, notFound } from "../http";
import { renderInvoiceHtml } from "../invoices/render";
import { findBrowser, htmlToPdf } from "../invoices/pdf";
import {
  createSale,
  deleteSale,
  getSaleByIdOrCode,
  getSales,
  getSalesByCustomer,
  updateSale,
} from "../services/sale";

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
  "/:id",
  asyncHandler(async (req, res) => {
    const sale = await getSaleByIdOrCode(req.params.id, req.auth.organizationId);
    if (!sale) throw notFound("Sale not found", "SALE_NOT_FOUND");
    res.json(sale);
  })
);

/** The sale and its tenant's name, or 404 -- shared by the two invoice routes. */
async function loadInvoice(idOrCode: string, organizationId: string) {
  const [sale, organization] = await Promise.all([
    getSaleByIdOrCode(idOrCode, organizationId),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
  ]);
  if (!sale || !organization) throw notFound("Sale not found", "SALE_NOT_FOUND");
  return renderInvoiceHtml({ organization, sale });
}

saleRouter.get(
  "/:id/print",
  asyncHandler(async (req, res) => {
    const html = await loadInvoice(req.params.id, req.auth.organizationId);
    // The page is ours and static; nothing in it needs to run or load.
    res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    res.type("html").send(html);
  })
);

saleRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const html = await loadInvoice(req.params.id, req.auth.organizationId);
    const browser = findBrowser();
    if (!browser) {
      throw new HttpError(
        503,
        "PDF export needs Chrome or Edge on the server. Set CHROME_PATH, or use the print view.",
        "PDF_UNAVAILABLE"
      );
    }
    const pdf = await htmlToPdf(html, browser);
    res
      .type("application/pdf")
      .set("Content-Disposition", `attachment; filename="invoice-${encodeURIComponent(req.params.id)}.pdf"`)
      .send(Buffer.from(pdf));
  })
);

saleRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = SaleInvoiceSchema.parse(req.body);

    // Every stock movement is written to `InventoryLog`, whose `userId` is
    // required. Until Checkpoint 3 replaces this middleware with a real
    // session, the caller has to say who they are.
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the inventory log " +
          "can be attributed.",
        "USER_REQUIRED"
      );
    }

    const sale = await createSale(
      data,
      req.auth.organizationId,
      req.auth.userId
    );
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
    // Returning the stock writes `InventoryLog` rows, which need a user.
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the inventory log " +
          "can be attributed.",
        "USER_REQUIRED"
      );
    }
    await deleteSale(req.params.id, req.auth.organizationId, req.auth.userId);
    res.status(204).send();
  })
);
