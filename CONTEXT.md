# Distribution Management System

Multi-tenant system for running a distribution business: products, purchases, sales, returns, inventory, and customers.

## Language

**Soft delete**:
Marking a Return or Sale with a deletion timestamp instead of removing the row, so the record survives as an audit trail.
_Avoid_: archive (that is `isActive`), delete

**Restore**:
Bringing a soft-deleted Return or Sale back to active state after re-checking that its stock effects can be re-applied.
_Avoid_: undelete, undo

**Recovery**:
Returning a Cancelled or soft-deleted invoice to active status as one concept; a recovered invoice has its stock effects re-applied under an availability check.
_Avoid_: reopen, resurrect

**Stock movement**:
A counted change to a product's on-hand quantity for one tenant, recorded with its reason and reference; a movement that would drive stock below zero is refused, never clamped.
_Avoid_: stock update, quantity change

**Movement ledger**:
The chronological record of stock movements, each carrying the quantity before and after, from which on-hand quantity can be reconciled.
_Avoid_: stock log, history

**Stock batch**:
A received quantity of a product tracked by batch number with its expiry date and unit cost, so units can be issued, credited back, and expired as one thing.
_Avoid_: lot

**First-expiry-first-out**:
The issue rule that stock leaves the batch expiring soonest first; every stock movement decides its batch consequences under this rule, including reversals.
_Avoid_: FIFO

**Payment**:
A record of money received from a customer, applied to a specific invoice; the sum of a customer's payments is what offsets their balance.

**Partial payment**:
An invoice settled for less than its total; the unpaid remainder is the balance due on that invoice.

**Customer ledger**:
The chronological account of one customer's invoices, returns (as credit entries), and payments, from which the balance due is derived.

**Balance due**:
Invoices minus returns minus payments for a customer, as of a date.

**Statement**:
A customer ledger rendered for a date range or as-of date, prepared to be sent to the customer on WhatsApp.

**Breakdown**:
A sale invoice's money figures — subtotal, tax split (CGST/SGST/IGST), discount, and total — derived from its line items; one breakdown serves the invoice on screen, on paper, and in the form that creates it.
_Avoid_: totals (that is just the total), calculation

**Member**:
One user's membership in one organization, carrying a role.

**Role**:
A named set of permissions assigned to a member; owner and admin are built in, everything else is defined per organization.
_Avoid_: access level, group

**Permission**:
The right to perform one action on one kind of record, evaluated before the action runs.
_Avoid_: capability, access right

**Invoice document**:
A sale invoice rendered as one document (PDF) for sending to or printing for a customer.
_Avoid_: export, hard copy

**Sales & Invoices**:
The customer-facing commercial interface for creating, viewing, and dispatching sale orders, tax invoices, and balance collection.
_Avoid_: sale records, order management system

**Incoming Stock / Purchases**:
The inventory replenishment flow capturing goods received from suppliers, purchase bills, and incoming inventory batch assignments.
_Avoid_: PO entry, vendor buy-in

**Stock Correction**:
The operational count adjustment reconciling physical shelf count with the system's recorded on-hand quantity, documenting the discrepancy reason (spoilage, breakage, count variance).
_Avoid_: inventory override, manual delta

**Batches & Expiry Dates**:
The operational lot view displaying received stock batches with expiry warnings, shelf-life indicators, and FEFO allocation status.
_Avoid_: batch table, expiry log

**Customer Statement**:
The human-friendly, shareable summary of a customer's invoices, returns, payments, and outstanding balance due over a given time window.
_Avoid_: customer ledger report, AR sub-ledger

**Supplier Statement**:
The summary of supplier purchase receipts, purchase returns, and amounts owed to a vendor.
_Avoid_: AP ledger, vendor liability sheet

**Team & Permissions**:
The administrative interface for managing organization members, their operational roles, and assigned access privileges.
_Avoid_: RBAC administration, user permissions editor

**Checkpoint**:
A numbered engineering milestone under `checkpoints/` (plan + tests + `parity-gate.ts` entry) whose green gate is the proof that a feature is done.
_Avoid_: approval (no approval workflow exists in the product), milestone

