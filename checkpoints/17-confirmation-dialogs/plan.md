# Checkpoint 17 — App-wide Confirmation Dialogs: Plan

## Goal

One confirmation surface for every operation that costs something to undo — replacing
the native `window.confirm` that scattered over destructive actions across the web app.

**Status: plan only.** The component and the page conversions landed in the
confirmation wave; the parity suite that pins this behaviour is intentionally not
written yet.

## Behaviour contract

### Component — `apps/web/src/components/ConfirmDialog.tsx`

Props: `open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive`,
`busy`, `onConfirm`, `onCancel`.

Contract:

- **`busy` cannot be got past.** Escape and the overlay click both land in
  `onOpenChange`, which refuses to dismiss while `busy` — a native confirm cannot show
  a busy state at all, which is the whole reason it is gone. While busy, both buttons
  are `disabled` and the confirm button shows a spinner.
- **`description` is required**, so every dialog names what is about to be lost (the
  record's code, the stock consequence, the balance consequence).
- `destructive` renders the confirm button in the destructive variant.
- Pages hold their own target state (row + action); the wording always names the exact
  record.

### Coverage — no native dialogs remain

Every destructive/expensive action routes through the dialog:

| Page | Actions behind the dialog |
|---|---|
| `CustomerList`, `ProductList`, `PurchaseList`, `SupplierList`, `UsersPage` | delete |
| `ReturnList` | delete (stock reversal), restore |
| `SaleInvoiceList` | delete, restore, **cancel, un-cancel** — one dialog, `action` dispatch, per-action copy |
| `PaymentsPage` | correct (reverse) a payment |

`window.confirm` / `window.alert` / `window.prompt`: **zero** occurrences under
`apps/web/src`.

## Parity suite outline (not yet written)

`checkpoints/17-confirmation-dialogs/parity.test.ts` — **source-level only** (the web
app has no test runner, so like the `04x` suites this one reads the source):

1. Walk `apps/web/src`: no `window.confirm(`, `window.alert(`, `window.prompt(`.
2. Every page that calls `api.delete(` also renders `<ConfirmDialog` (the list above).
3. `ConfirmDialog` refuses dismissal while busy (`if (!next && !busy)`), disables both
   buttons while busy, and requires a `description`.
4. `SaleInvoiceList` sets all four actions (`delete`/`restore`/`cancel`/`uncancel`) on
   the target state and never calls `handleCancel(`/`handleUncancel(` directly from a
   menu `onClick`.
5. Each usage passes a non-empty `description` naming the record.

No database required, so this suite also runs for a contributor without PostgreSQL.

## Intentional deviations from the legacy app

1. **Native confirms are gone.** They block the thread, cannot show progress, and on a
   slow connection a second click can land after the first delete already succeeded.
2. **Cancel and un-cancel confirm too.** They are reversible, but they change what the
   books say; an accidental click on a status flip is still a wrong statement.
3. **Restores confirm.** Re-applying stock is a real movement and can be refused; the
   dialog is where the operator reads the consequence before it runs.
