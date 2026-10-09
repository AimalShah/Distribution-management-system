# A distributed company (agency) maps to the Organization tenant

The client calls each company/agency it distributes for an "agency" and requires that one company's products, stock, invoices, customers, and reports never bleed into another's. Rather than adding a brand-level isolation layer, each company is an `Organization` — the existing tenant boundary. Every domain row already carries `organizationId`, the server refuses unscoped requests (`400 ORGANIZATION_REQUIRED`), and better-auth supports switching `activeOrganizationId`. A `Brand` stays a product-attribution label *inside* one company, not a tenant.

**Considered options:** brand-within-organization isolation was rejected — it would require new `brandId` columns on Inventory, Sale, Purchase, Return, Payment, Customer, and StockBatch, plus brand-scoped middleware in every service.

**Consequences:** the missing work is onboarding and switching companies (organization create/switch UI), not schema-level isolation. PRD §4.6 and §8 Q5 are resolved by this decision.

**Status:** accepted
