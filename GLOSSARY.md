# Distribution Management System

Domain vocabulary for a distribution business: sales and purchases of products, customer balances, and payments.

## Language

### Money owed

**Balance due**:
The amount a customer still owes us on a sale: sale total minus what has been paid toward it.
_Avoid_: outstanding amount, pending amount, "on credit" (for balances), remaining

**Overdue**:
A balance due whose due date has passed.

**Due date**:
The date a credit sale's balance due becomes payable.

### Payments

**Payment**:
Money a customer gives us against a sale balance due.
_Avoid_: settlement, receipt

**Store credit**:
Money we owe the customer, created when a sale return is made; the customer spends it on future sales instead of receiving cash.
_Avoid_: refund balance, credit (unqualified), return credit

### Guardrails

**Credit limit**:
The maximum balance due a customer is allowed to reach before a sale shows a warning that can be overridden.

**Credit term**:
How many days after a credit sale its balance due becomes payable (per-customer override of the company default).

### Documents

**Credit sale**:
A sale whose balance due is paid later, within its credit term; as opposed to a cash sale.
_Avoid_: "on credit"

**Created by**:
The user who created a document (sale, purchase). Shown on documents and listings.

## Not in this glossary

"Credit note" — this system does not issue credit notes; returns settle as store credit (ADR 0006).
