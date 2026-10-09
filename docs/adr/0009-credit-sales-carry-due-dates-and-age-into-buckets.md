# Credit sales carry due dates and age into buckets

Credit sales compute a **due date** from the customer's credit term (net-30 by default, overridable per customer). Overdue balances are surfaced as an **aging report** (0–30 / 31–60 / 61–90 / 90+). The dashboard **Outstanding** figure becomes a real sum of unpaid balances (replacing the current 25%-of-sales placeholder). No automatic interest or penalty is charged — that is an accounting/legal decision deferred to the client.

**Consequences:** `Sale` gains a due date; a sale over the customer's credit limit still posts but warns (ADR 0005).

**Status:** accepted
