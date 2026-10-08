import { Router } from "express";
import {
  BrandSchema,
  BrandUpdateSchema,
  brandListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  addBrand,
  getBrandById,
  getBrands,
  removeBrand,
  updateBrand,
} from "../services/brand";

export const brandRouter: Router = Router();

brandRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = brandListQuerySchema.parse(req.query);

    const result = await getBrands({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

brandRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const brand = await getBrandById(req.params.id, req.auth.organizationId);

    res.json(brand);
  })
);

brandRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    // The organization comes from the auth context. The legacy form carried an
    // organizationId field, but addBrand overwrote it with the session value, so
    // the field was collected and then discarded.
    const data = BrandSchema.parse(req.body);
    const brand = await addBrand(data, req.auth.organizationId);
    res.status(201).json(brand);
  })
);

brandRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = BrandUpdateSchema.parse(req.body);

    const brand = await updateBrand(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(brand);
  })
);

brandRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeBrand(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
