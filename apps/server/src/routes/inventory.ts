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
import { asyncHandler, badRequest, notFound } from "../http";
import {
  getExpiringSoonBatches,
  getStockBatchById,
  listStockBatches,
} from "../services/batch";
import {
  adjustInventory,
  createInventory,
  getInventory,
  getInventoryById,
  getInventoryLogs,
  getLowStock,
  updateInventorySettings,
} from "../services/inventory";

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
    const inventory = await createInventory(data, req.auth.organizationId);
    res.status(201).json(inventory);
  })
);

inventoryRouter.post(
  "/adjust",
  asyncHandler(async (req, res) => {
    const data = InventoryAdjustSchema.parse(req.body);

    // Every adjustment writes an `InventoryLog`, whose `userId` is required.
    // Until Checkpoint 3 replaces this middleware with a real session, the
    // caller has to say who they are.
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the inventory log " +
          "can be attributed.",
        "USER_REQUIRED"
      );
    }

    const inventory = await adjustInventory(
      data,
      req.auth.organizationId,
      req.auth.userId
    );
    res.json(inventory);
  })
);

inventoryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const inventory = await getInventoryById(
      req.params.id,
      req.auth.organizationId
    );
    if (!inventory) throw notFound("Inventory record not found", "INVENTORY_NOT_FOUND");
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
