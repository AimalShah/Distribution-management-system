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

### Sales & Field Roles

**Salesman**:
A system user (Member) who fulfills sales, delivers goods, and is credited on sale invoices. Eligible for pack-based commission.

**Order Booker**:
A field booking agent who visits customers and books orders. Managed by staff as an organizational record without requiring software login accounts; optionally assigned to invoices.
_Avoid_: sales rep, booking boy

**Pricing tier**:
The commercial pricing schedule applied to an invoice—either `Retail` or `Wholesale`—which sets default line-item unit prices from the product catalog while remaining fully editable during invoice creation.

**Salesman commission**:
An on-demand calculation managed in the Team section computed as `Total Packs Sold × Commission Rate Per Pack` across a salesman's completed invoices for a chosen date range.

## Not in this glossary

"Credit note" — this system does not issue credit notes; returns settle as store credit (ADR 0006).
