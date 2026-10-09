import { Router } from "express";
import { requireRoutePermission, type RoutePermissionTable } from "../middleware/rbac";
import { brandRouter } from "./brand";
import { categoryRouter } from "./category";
import { customerRouter } from "./customer";
import { dashboardRouter } from "./dashboard";
import { inventoryRouter } from "./inventory";
import { paymentRouter } from "./payment";
import { productRouter } from "./product";
import { purchaseRouter } from "./purchase";
import { returnRouter } from "./return";
import { inventoryReportRouter } from "./reports/inventory";
import { purchaseReportRouter } from "./reports/purchase";
import { salesReportRouter } from "./reports/sales";
import { roleRouter } from "./role";
import { saleRouter } from "./sale";
import { settingsRouter } from "./settings";
import { supplierRouter } from "./supplier";

export const apiRouter: Router = Router();

/**
 * What each mount below has to prove, keyed by the first path segment.
 *
 * The mapping sits next to the mount on purpose: the two have to agree, and a
 * reviewer should be able to see in one file that `/api/products` is guarded by
 * `products:*` and that nothing under `/api` is mounted without a row. The
 * verb-to-action rule each row inherits (`GET` -> `view`, `POST` -> `create`,
 * `PUT`/`PATCH` -> `update`, `DELETE` -> `delete`) and the exceptions to it live
 * with the types in `middleware/rbac.ts`.
 *
 * Three entries name a resource other than their own segment:
 *
 * - `payments` has no resource of its own: `PERMISSION_STATEMENT` lists twelve
 *   and `payments` is not one. A payment is a line in the customer's ledger and
 *   settles that customer's balance, so it is guarded as `customers`.
 * - `roles` is membership and access, which is what `users` covers.
 * - `dashboard` and `reports` are the same question asked twice: `reports:view`
 *   is what a tenant grants to read aggregated numbers.
 */
const PERMISSIONS: RoutePermissionTable = {
  products: { resource: "products" },
  purchases: { resource: "purchases" },
  sales: {
    resource: "sales",
    rules: [
      { method: "POST", path: "/:id/restore", action: "update" },
      { method: "POST", path: "/:id/cancel", action: "update" },
      { method: "POST", path: "/:id/uncancel", action: "update" },
    ],
  },
  inventory: {
    resource: "inventory",
    rules: [{ method: "POST", path: "/adjust", action: "adjust" }],
  },
  returns: {
    resource: "returns",
    rules: [{ method: "POST", path: "/:id/restore", action: "update" }],
  },
  customers: { resource: "customers" },
  payments: { resource: "customers" },
  suppliers: { resource: "suppliers" },
  categories: { resource: "categories" },
  brands: { resource: "brands" },
  settings: { resource: "settings" },
  roles: {
    resource: "users",
    rules: [{ method: "POST", path: "/members/:memberId", action: "update" }],
  },
  reports: { resource: "reports" },
  dashboard: { resource: "reports" },
};

/**
 * One guard, mounted once, ahead of every router below it.
 *
 * This is the whole enforcement seam: nothing else in the stack decides what a
 * caller may do, each router below only decides what the request *is*. Mounted
 * on `apiRouter` rather than in `app.ts` because `req.path` here is already
 * relative to `/api`, which is the shape the table is keyed on.
 */
apiRouter.use(requireRoutePermission(PERMISSIONS));

apiRouter.use("/products", productRouter);

apiRouter.use("/purchases", purchaseRouter);

apiRouter.use("/sales", saleRouter);

apiRouter.use("/inventory", inventoryRouter);

apiRouter.use("/returns", returnRouter);

apiRouter.use("/customers", customerRouter);

apiRouter.use("/payments", paymentRouter);

apiRouter.use("/suppliers", supplierRouter);

apiRouter.use("/categories", categoryRouter);

apiRouter.use("/brands", brandRouter);

apiRouter.use("/settings", settingsRouter);

apiRouter.use("/roles", roleRouter);

apiRouter.use("/reports/inventory", inventoryReportRouter);

apiRouter.use("/reports/purchase", purchaseReportRouter);

apiRouter.use("/reports/sales", salesReportRouter);

apiRouter.use("/reports/aging", (req, res, next) => {
  const queryIndex = req.url.indexOf("?");
  const queryPart = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  req.url = `/aging${queryPart}`;
  salesReportRouter(req, res, next);
});

apiRouter.use("/dashboard", dashboardRouter);

