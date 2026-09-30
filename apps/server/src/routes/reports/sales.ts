import { Router } from "express";
import {
  salesBasicQuerySchema,
  salesByCustomerQuerySchema,
  salesByProductQuerySchema,
  salesFullQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../../http";
import {
  getBasicSalesReport,
  getFullSalesReport,
  getSalesByCustomer,
  getSalesByProduct,
} from "../../services/reports/sales-report";

export const salesReportRouter: Router = Router();

/**
 * Strict-mount only: every route reads `req.auth.organizationId`, and unlike
 * the organization and member routers nothing here works without a tenant. The
 * legacy sales report functions took no organization at all.
 */
salesReportRouter.get(
  "/basic",
  asyncHandler(async (req, res) => {
    const query = salesBasicQuerySchema.parse(req.query);
    res.json(await getBasicSalesReport(req.auth.organizationId, query));
  })
);

salesReportRouter.get(
  "/by-customer",
  asyncHandler(async (req, res) => {
    const query = salesByCustomerQuerySchema.parse(req.query);
    res.json(await getSalesByCustomer(req.auth.organizationId, query));
  })
);

salesReportRouter.get(
  "/by-product",
  asyncHandler(async (req, res) => {
    const query = salesByProductQuerySchema.parse(req.query);
    res.json(await getSalesByProduct(req.auth.organizationId, query));
  })
);

salesReportRouter.get(
  "/full",
  asyncHandler(async (req, res) => {
    const query = salesFullQuerySchema.parse(req.query);
    res.json(await getFullSalesReport(req.auth.organizationId, query));
  })
);
