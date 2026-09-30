import { Router } from "express";
import {
  SupplierSchema,
  SupplierUpdateSchema,
  supplierListQuerySchema,
} from "@dms/shared";
import { asyncHandler, notFound } from "../http";
import {
  addSupplier,
  getSupplierById,
  getSuppliers,
  removeSupplier,
  updateSupplier,
} from "../services/supplier";

export const supplierRouter: Router = Router();

supplierRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = supplierListQuerySchema.parse(req.query);
    const result = await getSuppliers({
      organizationId: req.auth.organizationId,
      ...query,
    });
    res.json(result);
  })
);

supplierRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await getSupplierById(req.params.id, req.auth.organizationId);
    if (!supplier) throw notFound("Supplier not found", "SUPPLIER_NOT_FOUND");
    res.json(supplier);
  })
);

supplierRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = SupplierSchema.parse(req.body);
    const supplier = await addSupplier(data, req.auth.organizationId);
    res.status(201).json(supplier);
  })
);

supplierRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = SupplierUpdateSchema.parse(req.body);
    const supplier = await updateSupplier(
      req.params.id,
      data,
      req.auth.organizationId
    );
    res.json(supplier);
  })
);

supplierRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeSupplier(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
