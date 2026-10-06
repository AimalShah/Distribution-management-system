# Checkpoint 16 — Customer Ledger & WhatsApp Statements: Plan

## Goal

Give every customer a statement page: invoices, return credits and payments folded into
one running balance, with a date window — and a way to hand it to them over WhatsApp
without a server-side WhatsApp integration.

**Status: plan only.** The service and page landed in the ledger wave; the parity suite
that pins this behaviour is intentionally not written yet.

## Behaviour contract

### Server — derived ledger

`GET /api/customers/:id/ledger?from=&to=` returns:

```jsonc
{
  "customer": { "id", "customerCode", "name", "phone" },
  "from": "…ISO… | null",
  "to": "…ISO… | null",
  "openingBalance": 120,          // everything strictly before `from`
  "entries": [
    // date, type: "invoice" | "credit" | "payment", reference, description,
    // debit, credit, balance   ← balance is running, opening included
  ],
  "totals": { "invoices", "credits", "payments", "closingBalance" }
}
```

- **There is no stored balance.** Every figure is recomputed from live rows at read
  time — a `LedgerEntry` table would drift out of sync with the documents it summarises.
- Entries: active (not cancelled, not soft-deleted) sales → debit; SALE-type return
  credits → credit; live payments (allocated or on account) → credit. Write-offs,
  purchase returns and cancelled/deleted documents never appear.
- `to` is **inclusive of the whole calendar day** (an `upperExclusive` helper adds a day
  when the bound carries no time of day), `from` is inclusive from its time of day.
- No `from` ⇒ opening balance zero (whole history is in the window). No bounds at all ⇒
  queries still run, just unbounded — an empty `{}` filter is never attached to a
  scalar column.
- Same-instant ordering is fixed: invoice → credit → payment (the order the counter saw).
- `404 CUSTOMER_NOT_FOUND` for another tenant's customer; `400 VALIDATION_ERROR` for
  malformed dates.

### Web — statement + WhatsApp

- `CustomerLedgerPage` at `/customers/:id/ledger`: date-window inputs, five stat tiles
  (opening, invoices, credits, payments, closing), `@dms/ui` `<Table>` entries with the
  running balance, a closing line that reconciles against the totals.
- **Share on WhatsApp** builds a compact English summary (name, period, the five
  figures) and opens a `wa.me` deep link via `lib/whatsapp.ts`:
  - `normalizePhone`: `03001234567` → `923001234567` (10 digits starting `0`);
    anything else digit-normalised; empty → `null`.
  - `waLink(phone, text)` → `https://wa.me/<to>?text=<encoded>`, or `null` when there
    is no reachable number — the caller then **copies to clipboard** instead, so the
    button is never a dead end.
  - Nothing is sent automatically: no WhatsApp API token, no template approval; the
    sender is the human reviewing the draft. No `graph.facebook` / Cloud API calls
    anywhere in `apps/web/src`.
- `SaleInvoiceList` reuses the same helper for single-invoice sharing.

## Parity suite outline (not yet written)

`checkpoints/16-customer-ledger-whatsapp/parity.test.ts`:

**DB-backed:**

1. Full-history fold: invoice → credit → payment gives opening `0`, three ordered
   entries with running balances, totals matching.
2. Period statement: `from` opens with what was already owed; `to` covers the whole end
   day (a payment later that day is excluded, the day's credit included).
3. Cancelled / soft-deleted documents and corrected payments drop out of the statement.
4. Another tenant's customer → `404 CUSTOMER_NOT_FOUND`; malformed `from` → `400`.
5. Same-instant ordering: `[invoice, credit, payment]`.

**Source-level (no DB):**

6. `normalizePhone` / `waLink` rules (local `0…` → `92…`, `null` with no number,
   text URL-encoded).
7. Ledger page wired (route + endpoint + share button + clipboard fallback) and no
   WhatsApp transport beyond `wa.me`.

## Intentional deviations from the legacy app

1. **The legacy app had no statement.** Balances were per-invoice `amountPaid`
   arithmetic at best; there was nothing to send a customer.
2. **Derived, not stored.** A cached balance would be one more number to reconcile.
3. **`wa.me` deep link, not the WhatsApp Business API.** No token, no template
   approval, no message the operator did not personally send.
