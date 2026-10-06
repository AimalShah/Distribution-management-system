import { Router } from "express";
import { PaymentCreateSchema, paymentListQuerySchema } from "@dms/shared";
import { asyncHandler, badRequest, notFound } from "../http";
import { createPayment, deletePayment, getPaymentById, getPayments } from "../services/payment";

export const paymentRouter: Router = Router();

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
    if (!payment) throw notFound("Payment not found", "PAYMENT_NOT_FOUND");
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
    if (!req.auth.userId) {
      throw badRequest(
        "Missing user context. Send the x-user-id header so the payment can be " +
          "attributed to a member.",
        "USER_REQUIRED"
      );
    }

    const created = await createPayment(data, req.auth.organizationId, req.auth.userId);
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
