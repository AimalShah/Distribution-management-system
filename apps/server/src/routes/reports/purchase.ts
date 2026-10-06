import { Router } from "express";
import {
  purchaseBasicQuerySchema,
  purchaseByBrandQuerySchema,
  purchaseByProductQuerySchema,
  purchaseBySupplierQuerySchema,
  purchaseFullQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../../http";
import {
  getBasicPurchaseReport,
  getFullPurchaseReport,
  getPurchaseByBrand,
  getPurchaseByProduct,
  getPurchaseBySupplier,
} from "../../services/reports/purchase-report";

export const purchaseReportRouter: Router = Router();

/**
 * Strict-mount only: every route reads `req.auth.organizationId`, and unlike
 * the organization and member routers nothing here works without a tenant. The
 * legacy purchase report functions took no organization at all.
 */
purchaseReportRouter.get(
  "/basic",
  asyncHandler(async (req, res) => {
    const query = purchaseBasicQuerySchema.parse(req.query);
    res.json(await getBasicPurchaseReport(req.auth.organizationId, query));
  })
);

purchaseReportRouter.get(
  "/by-supplier",
  asyncHandler(async (req, res) => {
    const query = purchaseBySupplierQuerySchema.parse(req.query);
    res.json(await getPurchaseBySupplier(req.auth.organizationId, query));
  })
);

purchaseReportRouter.get(
  "/by-product",
  asyncHandler(async (req, res) => {
    const query = purchaseByProductQuerySchema.parse(req.query);
    res.json(await getPurchaseByProduct(req.auth.organizationId, query));
  })
);

purchaseReportRouter.get(
  "/by-brand",
  asyncHandler(async (req, res) => {
    const query = purchaseByBrandQuerySchema.parse(req.query);
    res.json(await getPurchaseByBrand(req.auth.organizationId, query));
  })
);

purchaseReportRouter.get(
  "/full",
  asyncHandler(async (req, res) => {
    const query = purchaseFullQuerySchema.parse(req.query);
    res.json(await getFullPurchaseReport(req.auth.organizationId, query));
  })
);
