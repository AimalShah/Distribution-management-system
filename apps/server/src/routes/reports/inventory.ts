import { Router } from "express";
import {
  inventoryBasicQuerySchema,
  inventoryExpiryQuerySchema,
  inventoryFullQuerySchema,
  inventoryLowStockQuerySchema,
  inventoryMovementsQuerySchema,
  inventoryStockValuationQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../../http";
import {
  getBasicInventoryReport,
  getExpiryReport,
  getFullInventoryReports,
  getInventoryMovements,
  getLowStockReport,
  getStockValuationReport,
} from "../../services/reports/inventory-report";

export const inventoryReportRouter: Router = Router();

/**
 * Every route here reads `req.auth.organizationId`, so unlike the organization
 * and member routers this one is mounted behind the strict `authContext` and
 * nothing about it works without a tenant. That is the point of the checkpoint:
 * the legacy report functions took no organization at all.
 */
inventoryReportRouter.get(
  "/basic",
  asyncHandler(async (req, res) => {
    const query = inventoryBasicQuerySchema.parse(req.query);
    res.json(
      await getBasicInventoryReport(req.auth.organizationId, query)
    );
  })
);

inventoryReportRouter.get(
  "/movements",
  asyncHandler(async (req, res) => {
    const query = inventoryMovementsQuerySchema.parse(req.query);
    res.json(await getInventoryMovements(req.auth.organizationId, query));
  })
);

inventoryReportRouter.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const query = inventoryLowStockQuerySchema.parse(req.query);
    res.json(await getLowStockReport(req.auth.organizationId, query));
  })
);

inventoryReportRouter.get(
  "/stock-valuation",
  asyncHandler(async (req, res) => {
    const query = inventoryStockValuationQuerySchema.parse(req.query);
    res.json(await getStockValuationReport(req.auth.organizationId, query));
  })
);

inventoryReportRouter.get(
  "/expiry",
  asyncHandler(async (req, res) => {
    const query = inventoryExpiryQuerySchema.parse(req.query);
    res.json(await getExpiryReport(req.auth.organizationId, query));
  })
);

inventoryReportRouter.get(
  "/full",
  asyncHandler(async (req, res) => {
    const query = inventoryFullQuerySchema.parse(req.query);
    res.json(await getFullInventoryReports(req.auth.organizationId, query));
  })
);
