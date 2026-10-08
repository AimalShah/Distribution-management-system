import { z } from "zod";
import { optionalDate, optionalText } from "../inputs";
import { paginationQuerySchema } from "../pagination";

/**
 * The methods a payment can be recorded against. A plain allowlist rather than
 * a free string, so a statement can group by method without every typo becoming
 * its own category.
 */
export const PaymentMethods = [
  "Cash",
  "Bank Transfer",
  "Mobile Wallet",
  "Cheque",
  "Other",
] as const;

/**
 * One record of money received.
 *
 * `saleId` omitted means the payment lands on the customer's account unallocated
 * (cash on account); present means it settles that invoice, and the service
 * moves `Sale.amountPaid` in the same transaction. Either way the customer must
 * be named, because the ledger is keyed by customer, not by invoice.
 */
export const PaymentCreateSchema = z.object({
  paymentCode: z.string().trim().min(3, "Payment code must be at least 3 characters"),
  customerId: z.string().trim().min(1, "Please select a customer"),
  saleId: z.string().trim().min(1, "Please select an invoice").optional(),
  amount: z
    .number("Expected a number")
    .positive("Payment amount must be greater than zero"),
  method: z.enum(PaymentMethods),
  reference: optionalText("Reference cannot be empty"),
  note: optionalText("Note cannot be empty"),
  // Absent means "now", matching saleDate and returnDate.
  paidAt: optionalDate,
});

export const paymentListQuerySchema = paginationQuerySchema.extend({
  customerId: z.string().trim().optional(),
  saleId: z.string().trim().optional(),
  // `deleted=true` is the correction view; absent means live payments only.
  deleted: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type PaymentMethodValue = (typeof PaymentMethods)[number];

export type PaymentCreateInput = z.output<typeof PaymentCreateSchema>;

export type PaymentListQuery = z.output<typeof paymentListQuerySchema>;
