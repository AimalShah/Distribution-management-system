# Specification: Multi-Company Management & Structured Profile Forms

## 1. Overview & Problem Statement
Currently in the application:
1. Navigating to **Company** (`/settings/company`) only presents configuration for the currently active company (Display Name, Address, GSTIN, SKU Format, Return Policy, Brands).
2. Users cannot create a second or subsequent company from the main application UI without somehow triggering the empty-tenant onboarding flow (`OnboardingPage`).
3. The layout for company profile, SKU formats, return policies, and brands is scattered across uncoordinated cards without a unified, structured workflow or company listing.
4. Per **ADR 0004** (`docs/adr/0004-a-company-maps-to-the-organization-tenant.md`) and **CONTEXT.md**, each distribution business ("agency") the user operates is an `Organization`. All data rows (`Product`, `Sale`, `Purchase`, `Customer`, etc.) are partitioned by `organizationId`.
5. The system needs a dedicated, professional **Company Management & Settings** experience where users can:
   - View all their companies in a structured list/overview.
   - Switch active company directly.
   - Create a new company via a polished, professional creation dialog/form.
   - Configure company-specific settings (Profile, SKU format, Return policy, Brands) in clean, well-structured tabs/sections.

---

## 2. Requirements & Capabilities

### Capability 1: Company Management View (`/settings/company`)
- **Structure**:
  - **Header**: Title ("Companies & Organization"), description, and a primary action button ("+ Create Company").
  - **Company Selector & Cards / List**:
    - Displays all companies where the user is a member.
    - Badges the currently active company ("Active").
    - Provides a one-click "Switch to this Company" action.
    - Displays key company metadata (Company Name, Slug, GSTIN, Address, Created Date).
  - **Tabbed / Structured Detail Section for Active Company**:
    - **Tab 1: Company Profile**: Form for Display Name, Address, GSTIN, Phone/Contact details.
    - **Tab 2: Document & Numbering (SKU Format)**: Interactive SKU format composer with real-time preview (using `@dms/shared` `buildSku`), token pickers, and separator input.
    - **Tab 3: Policies (Returns & Credit Terms)**: Configurable return window (days), return toggle, default credit term days.
    - **Tab 4: Brands**: Product brands attribution management (create, edit shortCode/name, list) cleanly embedded.

### Capability 2: Professional Create Company Modal / Flow
- **Fields**:
  - `name`: Company Name (e.g., "Al-Noor Distribution", required).
  - `slug`: Unique identifier (auto-generated from name with custom edit support, lowercase alphanumeric with hyphens, required).
  - `address`: Business address (optional/recommended).
  - `gstin`: Tax / GSTIN number (optional).
  - Initial settings (optional defaults automatically initialized: SKU format `{BRAND}-{CATEGORY}-{SEQ:5}`, default return window 30 days).
- **Behavior**:
  - Submits to `POST /api/organizations` to create the company with the caller as `owner`.
  - Automatically initializes or updates `CompanySettings` for the created company.
  - Asks user or automatically activates the new company (`POST /api/organizations/set-active`).
  - Toasts confirmation and refreshes the organization list across the topbar and page.

### Capability 3: Topbar & Navigation Integration
- Ensure the existing `CompanySwitcher` in `Topbar` reflects the newly created company instantly without requiring a full manual refresh.
- Enhance the `CompanySwitcher` dropdown with a "+ New Company" quick action item linking or opening the Create Company dialog.
- Update `AppSidebar` Settings section: label "Companies" pointing to `/settings/company`.

---

## 3. Data Model & Architecture (Aligning with ADR 0004 & CONTEXT.md)

1. **Entity Mapping**:
   - `Company` = `Organization` (`packages/db/prisma/schema.prisma:91`)
   - `CompanySettings` = `company_settings` (`packages/db/prisma/schema.prisma:124`)
   - `Member` = user membership associating the user with the company (`packages/db/prisma/schema.prisma:154`)

2. **Backend API Endpoints**:
   - `GET /api/organizations`: Returns all organizations for caller (`id, name, slug, address, gstin, createdAt`).
   - `POST /api/organizations`: Creates new organization and adds caller as owner.
   - `POST /api/organizations/set-active`: Sets active organization on the session.
   - `GET /api/settings`: Returns active company's `CompanySettings` (`displayName, address, gstin, skuFormat, skuSeparator, skuSequence, returnWindowDays, returnsEnabled, creditTermDays`).
   - `PUT /api/settings`: Updates active company's `CompanySettings`.

---

## 4. UI/UX Design System Compliance
- Avoid cluttered or scattered plain cards stacked vertically.
- Use clean tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) from `@dms/ui`.
- Professional form layout with standard field spacing, clear labels, helper text, and accessible validation states.
- Clean empty states and loading skeletons.
- Consistent visual hierarchy adhering to the DMS design tokens.

---

## 5. Verification & Testing Criteria
- **Unit & Integration Tests**:
  - `CompanySettingsPage.test.tsx`:
    - Renders company list and active company badge.
    - Opens Create Company dialog, validates inputs, and submits successfully.
    - Switches active company.
    - Loads and submits company settings tabs (Profile, SKU format, Return policy).
  - `CompanySwitcher.test.tsx`:
    - Displays active company.
    - Lists user's companies and triggers switch.
    - Contains "+ New Company" action.
- **Manual Verification**:
  - Create multiple companies (e.g. Company A, Company B).
  - Verify switching between them changes the active company in the topbar and filters products/orders accordingly.
