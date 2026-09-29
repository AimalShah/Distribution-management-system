import { Router } from "express";
import { productRouter } from "./product";
import { purchaseRouter } from "./purchase";

export const apiRouter: Router = Router();

apiRouter.use("/products", productRouter);
apiRouter.use("/purchases", purchaseRouter);
