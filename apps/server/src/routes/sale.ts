import { Router } from "express";
import {
  SaleInvoiceSchema,
  SaleUpdateSchema,
  paginationQuerySchema,
  saleListQuerySchema,
} from "@dms/shared";
import { asyncHandler, badRequest, notFound } from "../http";
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
    await deleteSale(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
