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

**Checkpoint**:
A numbered engineering milestone under `checkpoints/` (plan + tests + `parity-gate.ts` entry) whose green gate is the proof that a feature is done.
_Avoid_: approval (no approval workflow exists in the product), milestone
