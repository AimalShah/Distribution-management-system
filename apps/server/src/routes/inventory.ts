import { Router } from "express";
import {
  InventoryAdjustSchema,
  InventoryCreateSchema,
  InventorySettingsSchema,
  batchListQuerySchema,
  inventoryListQuerySchema,
  inventoryLogsQuerySchema,
  lowStockQuerySchema,
} from "@dms/shared";
import { asyncHandler, badRequest } from "../http";
import {
  getExpiringSoonBatches,
  getStockBatchById,
  listStockBatches,
} from "../services/batch";
import Papa from "papaparse";
import { z } from "zod";
import {
  adjustInventory,
  bulkImportInventory,
  createInventory,
  getInventory,
  getInventoryById,
  getInventoryLogs,
  getLowStock,
  updateInventorySettings,
} from "../services/inventory";
import { requireUserId } from "../middleware/auth-context";

export const inventoryRouter: Router = Router();

inventoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = inventoryListQuerySchema.parse(req.query);

    const result = await getInventory({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

// `/logs`, `/low-stock`, and `/batches` are registered before `/:id` so the literal segments
// always win; the plan listed `/:id` first, which would swallow all of them.
inventoryRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const query = inventoryLogsQuerySchema.parse(req.query);

    const result = await getInventoryLogs({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

inventoryRouter.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const query = lowStockQuerySchema.parse(req.query);

    const result = await getLowStock({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

inventoryRouter.get(
  "/batches",
  asyncHandler(async (req, res) => {
    const query = batchListQuerySchema.parse(req.query);
    const result = await listStockBatches(req.auth.organizationId, query);
    res.json(result);
  })
);

inventoryRouter.get(
  "/batches/expiring",
  asyncHandler(async (req, res) => {
    const days = req.query.days ? Number(req.query.days) : 30;
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const result = await getExpiringSoonBatches(req.auth.organizationId, days, limit);
    res.json(result);
  })
);

inventoryRouter.get(
  "/batches/:id",
  asyncHandler(async (req, res) => {
    const result = await getStockBatchById(req.params.id, req.auth.organizationId);
    res.json(result);
  })
);

inventoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = InventoryCreateSchema.parse(req.body);
    const inventory = await createInventory(data, req.auth.organizationId, req.auth.userId);
    res.status(201).json(inventory);
  })
);

inventoryRouter.post(
  "/adjust",
  asyncHandler(async (req, res) => {
    const data = InventoryAdjustSchema.parse(req.body);

    // Every adjustment writes an `InventoryLog`, whose `userId` is required, so
    // the caller has to say who they are.
    const userId = requireUserId(req.auth.userId);

    const inventory = await adjustInventory(data, req.auth.organizationId, userId);

    res.json(inventory);
  })
);

inventoryRouter.post(
  "/bulk-import",
  asyncHandler(async (req, res) => {
    let rows: any[] = [];

    if (Array.isArray(req.body)) {
      rows = req.body;
    } else if (req.body && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else if (typeof req.body === "string" || (req.body && typeof req.body.csv === "string")) {
      const csvStr = typeof req.body === "string" ? req.body : req.body.csv;

      const parsed = Papa.parse<Record<string, any>>(csvStr, {
        header: true,
        skipEmptyLines: "greedy",
      });

      rows = parsed.data.map((r) => ({
        productCode: r.productCode || r.product_code || r.code || r.sku,
        productName: r.productName || r.product_name || r.name,
        quantityOnHand: r.quantityOnHand ?? r.quantity ?? r.qty ?? r.stock,
        reorderLevel: r.reorderLevel ?? r.reorder_level ?? r.minStock,
        maxStockLevel: r.maxStockLevel ?? r.max_stock_level ?? r.maxStock,
      }));
    } else {
      throw badRequest(
        "Request body must contain 'rows' array or 'csv' string",
        "INVALID_BULK_IMPORT_PAYLOAD"
      );
    }

    const result = await bulkImportInventory(rows, req.auth.organizationId);
    res.json(result);
  })
);

inventoryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const inventory = await getInventoryById(
      req.params.id,
      req.auth.organizationId
    );

    res.json(inventory);
  })
);

inventoryRouter.put(
  "/:id/settings",
  asyncHandler(async (req, res) => {
    const data = InventorySettingsSchema.parse(req.body);

    const inventory = await updateInventorySettings(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(inventory);
  })
);
