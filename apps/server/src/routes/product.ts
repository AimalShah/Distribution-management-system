import { Router } from "express";
import {
  ProductSchema,
  ProductUpdateSchema,
  productListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  addProduct,
  getProductById,
  getProducts,
  removeProduct,
  updateProduct,
} from "../services/product";

export const productRouter: Router = Router();

productRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = productListQuerySchema.parse(req.query);

    const result = await getProducts({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

productRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id, req.auth.organizationId);

    res.json(product);
  })
);

productRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = ProductSchema.parse(req.body);
    const product = await addProduct(data, req.auth.organizationId);
    res.status(201).json(product);
  })
);

productRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = ProductUpdateSchema.parse(req.body);

    const product = await updateProduct(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(product);
  })
);

productRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await removeProduct(req.params.id, req.auth.organizationId);
    res.status(204).send();
  })
);
