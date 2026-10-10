import { Router } from "express";
import {
  PurchaseFormSchema,
  PurchaseUpdateSchema,
  paginationQuerySchema,
  purchaseListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  createPurchase,
  deletePurchase,
  getPurchaseById,
  getPurchases,
  getPurchasesBySupplier,
  updatePurchase,
} from "../services/purchase";
import { requireUserId } from "../middleware/auth-context";
import { generatePurchasePdf } from "../services/purchase-pdf";
import { renderPurchaseOrderHtml } from "../services/purchase-order-template";
import { getCompanySettings } from "../services/settings";

export const purchaseRouter: Router = Router();

async function withCompanyProfile<T extends object>(purchase: T, organizationId: string) {
  const settings = await getCompanySettings(organizationId);

  return {
    ...purchase,
    company: {
      name: settings.displayName,
      address: settings.address,
      gstin: settings.gstin,
    },
  };
}

purchaseRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const purchase = await getPurchaseById(
      req.params.id,
      req.auth.organizationId
    );

    const withComp = await withCompanyProfile(purchase, req.auth.organizationId);
    const pdf = await generatePurchasePdf({
      company: withComp.company,
      purchase: withComp as any,
    });

    res
      .type("pdf")
      .set(
        "Content-Disposition",
        `inline; filename="purchase-order-${purchase.purchaseCode}.pdf"`
      )
      .send(Buffer.from(pdf));
  })
);

purchaseRouter.get(
  "/:id/html",
  asyncHandler(async (req, res) => {
    const purchase = await getPurchaseById(
      req.params.id,
      req.auth.organizationId
    );

    const withComp = await withCompanyProfile(purchase, req.auth.organizationId);
    const html = renderPurchaseOrderHtml({
      company: withComp.company,
      purchase: withComp as any,
    });

    res.type("html").send(html);
  })
);

purchaseRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = purchaseListQuerySchema.parse(req.query);

    const result = await getPurchases({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

// Registered before `/:id` so the literal segment always wins.
purchaseRouter.get(
  "/supplier/:supplierId",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = paginationQuerySchema.parse(req.query);

    const result = await getPurchasesBySupplier({
      supplierId: req.params.supplierId,
      organizationId: req.auth.organizationId,
      page,
      pageSize,
    });

    res.json(result);
  })
);

purchaseRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchase = await getPurchaseById(
      req.params.id,
      req.auth.organizationId
    );

    res.json(purchase);
  })
);

purchaseRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = PurchaseFormSchema.parse(req.body);

    // Every stock movement is written to `InventoryLog`, whose `userId` is
    // required, so the caller has to say who they are.
    const userId = requireUserId(req.auth.userId);

    const purchase = await createPurchase(data, req.auth.organizationId, userId);

    res.status(201).json(purchase);
  })
);

purchaseRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = PurchaseUpdateSchema.parse(req.body);

    const purchase = await updatePurchase(
      req.params.id,
      data,
      req.auth.organizationId
    );

    res.json(purchase);
  })
);

purchaseRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deletePurchase(req.params.id, req.auth.organizationId, req.auth.userId);
    res.status(204).send();
  })
);
