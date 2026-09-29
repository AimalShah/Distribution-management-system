import { Router } from "express";
import { inventoryRouter } from "./inventory";
import { productRouter } from "./product";
import { purchaseRouter } from "./purchase";
import { returnRouter } from "./return";
import { saleRouter } from "./sale";

export const apiRouter: Router = Router();

apiRouter.use("/products", productRouter);
apiRouter.use("/purchases", purchaseRouter);
apiRouter.use("/sales", saleRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/returns", returnRouter);
