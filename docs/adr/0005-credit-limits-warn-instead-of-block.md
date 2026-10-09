# Credit limits warn instead of block

A sale whose total would push a customer past their credit limit is allowed but flagged, rather than refused. Distributors routinely need to ship to a trusted customer who is temporarily over limit, and a hard block pushes staff to work around the system (splitting invoices, editing the limit). The override is gated by a permission (`sales.override_credit_limit`).

**Consequences:** the credit limit is advisory data and a warning surface, not a server-enforced invariant.

**Status:** accepted
