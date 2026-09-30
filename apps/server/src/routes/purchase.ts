import { Router } from "express";
import {
  PurchaseFormSchema,
  PurchaseUpdateSchema,
  paginationQuerySchema,
  purchaseListQuerySchema,
} from "@dms/shared";
import { asyncHandler, badRequest, notFound } from "../http";
import {
  createPurchase,
  deletePurchase,
  getPurchaseById,
  getPurchases,
  getPurchasesBySupplier,
  updatePurchase,
} from "../services/purchase";

export const purchaseRouter: Router = Router();

purchaseRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = purchaseListQuerySchema.parse(req.query);
    const result = await getPurchases({
      organizationId: req.auth.organizationId,
      ...query,
    });
    res.json(result);
  })
);

// Registered before `/:id` so the literal segment always wins.
purchaseRouter.get(
  "/supplier/:supplierId",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationQuerySchema.parse(req.query);
    const result = await getPurchasesBySupplier({
      supplierId: req.params.supplierId,
      organizationId: req.auth.organizationId,
      page,
      pageSize,
    });
    res.json(result);
  })
);

purchaseRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchase = await getPurchaseById(
      req.params.id,
      req.auth.organizationId
    );
    if (!purchase) throw notFound("Purchase not found", "PURCHASE_NOT_FOUND");
    res.json(purchase);
  })
);

purchaseRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = PurchaseFormSchema.parse(req.body);

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

    const purchase = await createPurchase(
      data,
      req.auth.organizationId,
      req.auth.userId
    );
    res.status(201).json(purchase);
  })
);

purchaseRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = PurchaseUpdateSchema.parse(req.body);
    const purchase = await updatePurchase(
      req.params.id,
      data,
      req.auth.organizationId
    );
    res.json(purchase);
  })
);

purchaseRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deletePurchase(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
