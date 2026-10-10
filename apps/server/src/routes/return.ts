import { Router } from "express";
import {
  ReturnCreateSchema,
  ReturnUpdateSchema,
  returnListQuerySchema,
} from "@dms/shared";
import { asyncHandler } from "../http";
import {
  createReturn,
  deleteReturn,
  getReturnByIdOrCode,
  getReturns,
  restoreReturn,
  updateReturn,
} from "../services/return";
import { requireUserId } from "../middleware/auth-context";
import { generateReturnPdf } from "../services/return-pdf";
import { renderCreditNoteHtml } from "../services/credit-note-template";
import { getCompanySettings } from "../services/settings";

export const returnRouter: Router = Router();

async function withCompanyProfile<T extends object>(record: T, organizationId: string) {
  const settings = await getCompanySettings(organizationId);

  return {
    ...record,
    company: {
      name: settings.displayName,
      address: settings.address,
      gstin: settings.gstin,
    },
  };
}

returnRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const found = await getReturnByIdOrCode(req.params.id, req.auth.organizationId);
    const withComp = await withCompanyProfile(found, req.auth.organizationId);

    const pdf = await generateReturnPdf({
      company: withComp.company,
      returnRecord: withComp as any,
    });

    res
      .type("pdf")
      .set(
        "Content-Disposition",
        `inline; filename="return-note-${found.returnCode}.pdf"`
      )
      .send(Buffer.from(pdf));
  })
);

returnRouter.get(
  "/:id/html",
  asyncHandler(async (req, res) => {
    const found = await getReturnByIdOrCode(req.params.id, req.auth.organizationId);
    const withComp = await withCompanyProfile(found, req.auth.organizationId);

    const html = renderCreditNoteHtml({
      company: withComp.company,
      returnRecord: withComp as any,
    });

    res.type("html").send(html);
  })
);

returnRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = returnListQuerySchema.parse(req.query);

    const result = await getReturns({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

returnRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = ReturnCreateSchema.parse(req.body);

    // Every return writes at least one `InventoryLog`, whose `userId` is
    // required: the caller has to say who they are.
    const userId = requireUserId(req.auth.userId);

    const created = await createReturn(data, req.auth.organizationId, userId);
    res.status(201).json(created);
  })
);

returnRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const found = await getReturnByIdOrCode(req.params.id, req.auth.organizationId);

    res.json(found);
  })
);

returnRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = ReturnUpdateSchema.parse(req.body);
    const updated = await updateReturn(req.params.id, data, req.auth.organizationId);
    res.json(updated);
  })
);

returnRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // A delete reverses the stock the return moved, so it writes ledger rows and
    // needs the same attribution as the create.
    const userId = requireUserId(req.auth.userId);

    const deleted = await deleteReturn(req.params.id, req.auth.organizationId, userId);

    res.json(deleted);
  })
);

// Registered after `delete` but matched by method, so the literal `restore`
// segment has no ambiguity with `/:id`.
returnRouter.post(
  "/:id/restore",
  asyncHandler(async (req, res) => {
    // A restore re-applies the stock movement the delete reversed, so it writes
    // ledger rows and needs attribution for exactly the same reason.
    const userId = requireUserId(req.auth.userId);

    const restored = await restoreReturn(req.params.id, req.auth.organizationId, userId);

    res.json(restored);
  })
);
