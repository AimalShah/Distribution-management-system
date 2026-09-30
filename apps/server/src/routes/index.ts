import { Router } from "express";
import { brandRouter } from "./brand";
import { categoryRouter } from "./category";
import { customerRouter } from "./customer";
import { inventoryRouter } from "./inventory";
import { productRouter } from "./product";
import { purchaseRouter } from "./purchase";
import { returnRouter } from "./return";
import { inventoryReportRouter } from "./reports/inventory";
import { purchaseReportRouter } from "./reports/purchase";
import { saleRouter } from "./sale";
import { supplierRouter } from "./supplier";

export const apiRouter: Router = Router();

apiRouter.use("/products", productRouter);
apiRouter.use("/purchases", purchaseRouter);
apiRouter.use("/sales", saleRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/returns", returnRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/suppliers", supplierRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/brands", brandRouter);
apiRouter.use("/reports/inventory", inventoryReportRouter);
apiRouter.use("/reports/purchase", purchaseReportRouter);
