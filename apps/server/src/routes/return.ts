import { Router } from "express";
import {
  ReturnCreateSchema,
  ReturnUpdateSchema,
  returnListQuerySchema,
} from "@dms/shared";
import { asyncHandler, badRequest, notFound } from "../http";
import {
  createReturn,
  deleteReturn,
  getReturnByIdOrCode,
  getReturns,
  updateReturn,
} from "../services/return";

export const returnRouter: Router = Router();

returnRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = returnListQuerySchema.parse(req.query);
    const result = await getReturns({
      organizationId: req.auth.organizationId,
      ...query,
    });
    res.json(result);
  })
);

returnRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = ReturnCreateSchema.parse(req.body);

    // Every return writes at least one `InventoryLog`, whose `userId` is
    // required. Until Checkpoint 3 replaces this middleware with a real session,
    // the caller has to say who they are.
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the stock movements " +
          "can be attributed.",
        "USER_REQUIRED"
      );
    }

    const created = await createReturn(data, req.auth.organizationId, req.auth.userId);
    res.status(201).json(created);
  })
);

returnRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const found = await getReturnByIdOrCode(req.params.id, req.auth.organizationId);
    if (!found) throw notFound("Return not found", "RETURN_NOT_FOUND");
    res.json(found);
  })
);

returnRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = ReturnUpdateSchema.parse(req.body);
    const updated = await updateReturn(req.params.id, data, req.auth.organizationId);
    res.json(updated);
  })
);

returnRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // A delete reverses the stock the return moved, so it writes ledger rows and
    // needs the same attribution as the create.
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the stock reversal " +
          "can be attributed.",
        "USER_REQUIRED"
      );
    }

    const deleted = await deleteReturn(
      req.params.id,
      req.auth.organizationId,
      req.auth.userId
    );
    res.json(deleted);
  })
);
