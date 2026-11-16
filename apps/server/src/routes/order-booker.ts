import { Router } from "express";
import {
  OrderBookerSchema,
  OrderBookerUpdateSchema,
  orderBookerListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  createOrderBooker,
  getOrderBookerById,
  listOrderBookers,
  updateOrderBooker,
} from "../services/order-booker";

export const orderBookerRouter: Router = Router();

orderBookerRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = orderBookerListQuerySchema.parse(req.query);

    const result = await listOrderBookers({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

orderBookerRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const booker = await getOrderBookerById(
      req.params.id,
      req.auth.organizationId
    );

    res.json(booker);
  })
);

orderBookerRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = OrderBookerSchema.parse(req.body);
    const booker = await createOrderBooker(data, req.auth.organizationId);
    res.status(201).json(booker);
  })
);

orderBookerRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = OrderBookerUpdateSchema.parse(req.body);
    const booker = await updateOrderBooker(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(booker);
  })
);

orderBookerRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = OrderBookerUpdateSchema.parse(req.body);
    const booker = await updateOrderBooker(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(booker);
  })
);
