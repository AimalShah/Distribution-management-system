import { Router } from "express";
import { PaymentCreateSchema, paymentListQuerySchema } from "@dms/shared";
import { asyncHandler } from "../http";
import { createPayment, deletePayment, getPaymentById, getPayments } from "../services/payment";
import { requireUserId } from "../middleware/auth-context";

import { generatePaymentPdf } from "../services/payment-pdf";
import { renderPaymentReceiptHtml } from "../services/payment-receipt-template";
import { getCompanySettings } from "../services/settings";

export const paymentRouter: Router = Router();

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

paymentRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const payment = await getPaymentById(req.params.id, req.auth.organizationId);
    const withComp = await withCompanyProfile(payment, req.auth.organizationId);

    const pdf = await generatePaymentPdf({
      company: withComp.company,
      payment: withComp as any,
    });

    res
      .type("pdf")
      .set(
        "Content-Disposition",
        `inline; filename="receipt-${payment.id.slice(-8)}.pdf"`
      )
      .send(Buffer.from(pdf));
  })
);

paymentRouter.get(
  "/:id/html",
  asyncHandler(async (req, res) => {
    const payment = await getPaymentById(req.params.id, req.auth.organizationId);
    const withComp = await withCompanyProfile(payment, req.auth.organizationId);

    const html = renderPaymentReceiptHtml({
      company: withComp.company,
      payment: withComp as any,
    });

    res.type("html").send(html);
  })
);

paymentRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = paymentListQuerySchema.parse(req.query);

    const result = await getPayments({
      organizationId: req.auth.organizationId,
      ...query,
    });

    res.json(result);
  })
);

paymentRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const payment = await getPaymentById(req.params.id, req.auth.organizationId);

    res.json(payment);
  })
);

paymentRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = PaymentCreateSchema.parse(req.body);

    // A payment moves money, and a payment against an invoice advances
    // `Sale.amountPaid`. Neither of those ledger effects has a `userId` of its
    // own to fall back on, so the caller has to say who they are.
    const userId = requireUserId(req.auth.userId);

    const created = await createPayment(data, req.auth.organizationId, userId);
    res.status(201).json(created);
  })
);

paymentRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    // A correction stamps the row; it moves no stock and needs no separate
    // attribution, so unlike the create it works without a user header.
    const corrected = await deletePayment(req.params.id, req.auth.organizationId);
    res.json(corrected);
  })
);
