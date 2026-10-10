# Statement of Intent: Company Management

## Outcome
A polished Company Management module that lets the client create and manage multiple separate companies, with data separated per company and a company switcher in the UI.

## User
A single client/business owner managing multiple separate businesses/companies within the distribution management system.

## Why Now
The current company screen is broken and only has scattered, unstructured inputs for SKU format and brands without an actual ability to create new companies, view existing companies, or manage company-level data properly.

## Success Criteria
- The user can easily create a new company using a professional, structured form (company basic details, contact info, SKU format, brands).
- The user can view a clean list/card view of all existing companies.
- The user can switch between companies via a UI switcher (header/sidebar) to scope and view data separately per company.
- Existing scattered forms are refactored into clean, professional, and intuitive layouts.

## Constraints
- Not full SaaS multi-tenancy: no billing, subscriptions, or complex cross-tenant isolation clusters.
- Single-client application with clean company-scoped data separation.

## Out of Scope
- SaaS subscription tiers / billing integrations.
- External organization user invitations / complex role-based tenant routing.
- Separate physical databases per company.
