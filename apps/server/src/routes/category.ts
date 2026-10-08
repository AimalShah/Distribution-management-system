import { Router } from "express";
import {
  CategorySchema,
  CategoryUpdateSchema,
  categoryListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  addCategory,
  getCategories,
  getCategoryById,
  removeCategory,
  updateCategory,
} from "../services/category";

export const categoryRouter: Router = Router();

categoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = categoryListQuerySchema.parse(req.query);

    const result = await getCategories({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

categoryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const category = await getCategoryById(req.params.id, req.auth.organizationId);

    res.json(category);
  })
);

categoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = CategorySchema.parse(req.body);
    const category = await addCategory(data, req.auth.organizationId);
    res.status(201).json(category);
  })
);

categoryRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = CategoryUpdateSchema.parse(req.body);

    const category = await updateCategory(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(category);
  })
);

categoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeCategory(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
