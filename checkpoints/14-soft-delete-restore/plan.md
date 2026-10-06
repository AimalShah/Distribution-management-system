# Checkpoint 14 — Soft Delete & Restore (Invoices, Returns): Plan

## Goal

Replace the hard `DELETE` on sale invoices and returns with a reversible soft delete:
stamp the row, reverse the stock it moved, hide it from every default list, and offer
a restore that puts both back — plus a "Deleted" tab in the web UI so an operator can
find and undo a mistake without a database.

**Status: plan only.** The service code landed in the soft-delete wave; the parity
suite that pins this behaviour is intentionally not written yet (see
"Parity suite outline" — it is the contract the suite will assert).

## Behaviour contract

### Server

| Operation | Route | Effect |
|---|---|---|
| Soft delete invoice | `DELETE /api/sales/:id` | `deletedAt = now`, stock **incremented** back (one `IN` log row `Reversal of sale <code>`), row + line items kept |
| Restore invoice | `POST /api/sales/:id/restore` | Guarded decrement (refuses rather than clamps), `OUT` log `Restoration of sale <code>`, `deletedAt = null` |
| Soft delete return | `DELETE /api/returns/:id` | `deletedAt = now`, stock movement reversed (SALE return = decrease, write-off = increase), line items kept |
| Restore return | `POST /api/returns/:id/restore` | Re-applies the original movement, `deletedAt = null` |
| List flag | `GET /api/sales?deleted=true` · `GET /api/returns?deleted=true` | `deleted=true` shows tombstones only; absent shows active only. `deleted=false` = active |

Guards (all `409` unless noted):

- `SALE_ALREADY_DELETED` / `RETURN_ALREADY_DELETED` — delete stamped twice.
- `SALE_NOT_DELETED` / `RETURN_NOT_DELETED` — restore on a live row.
- `INSUFFICIENT_STOCK_FOR_RESTORE` — the stock an invoice re-takes has been sold on since.
  The refusal is inside the transaction: row stays stamped, stock unchanged.
- `INSUFFICIENT_STOCK_FOR_REVERSAL` — deleting a SALE return whose goods were sold on
  (covered in 02e, restated here as a cross-guard).
- `SALE_HAS_PAYMENTS` (`amountPaid > 0`) and `SALE_HAS_RETURNS` (active returns exist) —
  an invoice that money or goods still reference cannot be deleted until those are
  corrected first.
- `404 SALE_NOT_FOUND` / `RETURN_NOT_FOUND` for another tenant's row (scoped `findFirst`).
- `400 USER_REQUIRED` on all four routes — the stock reversal writes `InventoryLog`
  rows whose `userId` is required, so the caller must send `x-user-id`.

Stock reversal is a `Serializable` transaction, same as create: the increment and the
stamp commit or roll back together.

### Web

- `ReturnList` and `SaleInvoiceList` gain a segmented **Active / Deleted** view.
  The Deleted view queries `?deleted=true` and shows a restore action per row.
- Delete and restore both run behind the shared `ConfirmDialog` (Checkpoint 17's
  component; see `17-confirmation-dialogs`), never `window.confirm`.

## Parity suite outline (not yet written)

`checkpoints/14-soft-delete-restore/parity.test.ts`, DB-backed via
`checkpoints/support/parity-db.ts`:

1. Active list drops a deleted invoice; `deleted=true` shows only tombstones; both flags
   for returns.
2. Restore round-trip: stock re-applied, `deletedAt` cleared, `Restoration of sale` log.
3. `INSUFFICIENT_STOCK_FOR_RESTORE`: sold-on stock → 409, row stays stamped, stock untouched.
4. Double delete → `SALE_ALREADY_DELETED`; restore of live row → `SALE_NOT_DELETED`
   (and the return pair).
5. All four routes → `400 USER_REQUIRED` without `x-user-id`.
6. `SALE_HAS_PAYMENTS` / `SALE_HAS_RETURNS` refuse deletion.
7. Web source: both list pages pass `deleted=true`, offer restore, and use `ConfirmDialog`.

Plus a source-level describe (no DB) for the web wiring.

## Intentional deviations from the legacy app

1. **Legacy `deleteSale`/`deleteReturn` removed the row.** Soft delete keeps it: the
   stock reversal is a movement, and a movement you cannot see cannot be audited.
   The legacy service had no stock handling on return delete at all.
2. **Restore can be refused.** The legacy app had no restore; where stock has moved on,
   the answer is 409 rather than a negative balance.
3. **Payments and returns block deletion** rather than being cascade-handled — deleting
   a document that money references would strand the money.
