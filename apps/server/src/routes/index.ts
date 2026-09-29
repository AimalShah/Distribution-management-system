import { Router } from "express";
import { productRouter } from "./product";
import { purchaseRouter } from "./purchase";
import { saleRouter } from "./sale";

export const apiRouter: Router = Router();

apiRouter.use("/products", productRouter);
apiRouter.use("/purchases", purchaseRouter);
apiRouter.use("/sales", saleRouter);
