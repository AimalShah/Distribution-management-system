import { Router } from "express";
import { productRouter } from "./product";

export const apiRouter: Router = Router();

apiRouter.use("/products", productRouter);
