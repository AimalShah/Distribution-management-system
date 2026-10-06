# Checkpoint 15 — Payments & Invoice Lifecycle (Cancel / Un-cancel): Plan

## Goal

Record money in: a `Payment` entity that settles a named invoice or lands on the
customer's account, with corrections that never erase history — and make cancellation a
first-class, reversible invoice state that sits beside delete instead of replacing it.

**Status: plan only.** The service code landed in the payments wave; the parity suite
that pins this behaviour is intentionally not written yet.

## Behaviour contract

### Schema

New model `Payment` (`paymentCode` unique, `saleId` SetNull so a corrected/removed
invoice does not orphan the money record, `deletedAt` for corrections) plus on `Sale`:
`amountPaid`, `statusBeforeCancel`. Relations on Organization/User/Customer.

### Server

| Operation | Route | Effect |
|---|---|---|
| Record payment | `POST /api/payments` | With `saleId`: conditional-update guard advances `Sale.amountPaid` **in the same transaction** (`amountPaid <= remaining - amount` evaluated by the database). Without: on-account credit, `saleId = null` |
| List / read | `GET /api/payments` · `GET /api/payments/:id` | `deleted=true` is the correction view; absent = live only |
| Correct payment | `DELETE /api/payments/:id` | Soft delete + guarded decrement (`amountPaid >= amount`); row stays visible in the correction view |
| Cancel invoice | `POST /api/sales/:id/cancel` | `status = Cancelled`, remembers `statusBeforeCancel`; **no stock movement** |
| Un-cancel | `POST /api/sales/:id/uncancel` | Restores `statusBeforeCancel ?? Pending`, clears the memory |

Guards:

- `PAYMENT_EXCEEDS_BALANCE` (409) — over-payment; the conditional update means two
  concurrent payments that each fit the balance they read cannot both land.
- `SALE_DELETED` (409), `SALE_CANCELLED` (409), `SALE_CUSTOMER_MISMATCH` (400),
  `SALE_NOT_IN_ORGANIZATION` (400), `CUSTOMER_NOT_IN_ORGANIZATION` (400) — the payment
  must reference a live invoice of the named customer in this tenant.
- `PAYMENT_ALREADY_DELETED` (409), `PAYMENT_BALANCE_UNDERFLOW` (409) — a correction can
  never drive `amountPaid` negative, even if the ledger was repaired by hand.
- `SALE_HAS_PAYMENTS` / `SALE_HAS_RETURNS` (409) — cancel refuses while money or goods
  reference the document (same guards as delete).
- `SALE_ALREADY_CANCELLED` / `SALE_NOT_CANCELLED` (409), `SALE_NOT_FOUND` (404).
- `400 USE_CANCEL_ENDPOINT` — a PUT carrying `status: "Cancelled"` is refused; status
  changes go through the dedicated route so the guards cannot be skipped.
- `409 SALE_IS_CANCELLED` — editing a cancelled invoice via PUT is refused.
- `400 USER_REQUIRED` on `POST /api/payments` (attribution). Cancel/uncancel/correction
  move no stock and need no user header.

### Web

- New `PaymentsPage` at `/payments` (sidebar section "Payments"): list, Active /
  Corrected views, record-payment dialog (customer → invoice with balance due, amount,
  method, reference, paid on, note), correction via `ConfirmDialog`.
- `SaleInvoiceList` gains Cancel / Un-cancel menu items, both behind `ConfirmDialog`
  with per-action copy (`action: "delete" | "restore" | "cancel" | "uncancel"`).

## Parity suite outline (not yet written)

`checkpoints/15-payments-invoice-lifecycle/parity.test.ts`, DB-backed:

1. Payment settles the invoice: `amountPaid` advances, list shows sale + customer.
2. Over-payment refused at the remaining balance; exact remaining then lands.
3. On-account payment: `saleId` null, every invoice untouched.
4. Payment guards: `SALE_DELETED`, `SALE_CANCELLED`, `SALE_CUSTOMER_MISMATCH`.
5. `POST /api/payments` → `400 USER_REQUIRED`.
6. Cancel refused with `SALE_HAS_PAYMENTS` / `SALE_HAS_RETURNS`.
7. Cancel/uncancel round-trip: status memory, **stock unchanged** both ways, works with
   no user header.
8. PUT `status: "Cancelled"` → `400 USE_CANCEL_ENDPOINT`; PUT edit on a cancelled
   invoice → `409 SALE_IS_CANCELLED`; double-cancel / uncancel-live refused.
9. Correction: balance moves back, row stays visible in `deleted=true`, second
   correction refused, `PAYMENT_BALANCE_UNDERFLOW` refuses a hand-repaired ledger.
10. Web source: PaymentsPage wired (route + sidebar), invoice actions behind the dialog.

## Intentional deviations from the legacy app

1. **Payments are rows, not a number on the invoice.** The legacy app only stored
   `amountPaid`, so "who paid what, when, by which method" was unrecoverable and a
   correction could only rewrite the total.
2. **Corrections soft delete.** A payment that vanishes cannot reconcile against what
   the counter actually did.
3. **Cancel does not move stock; delete does.** Cancel is the cheap "this document
   should not count" switch; delete is the expensive "put the goods back" one. The
   asymmetry is deliberate and pinned by the suites.
4. **Hybrid payment model:** `saleId` optional — on-account money is still keyed to a
   customer (the ledger is customer-keyed, not invoice-keyed).
