# Implementation Plan: Multi-Company Management & Structured Profile Forms

Based on [docs/specs/company-management.md](file:///home/aimalshah/code/Distribution-management-system/docs/specs/company-management.md) and [docs/intent/company-management.md](file:///home/aimalshah/code/Distribution-management-system/docs/intent/company-management.md).

---

### Task 1: Create Reusable `CreateCompanyDialog` Component
- **File**: `apps/web/src/components/settings/CreateCompanyDialog.tsx`
- **Goal**:
  - Modal dialog using Dialog components from `@dms/ui`.
  - Form built with `react-hook-form` and zod validation:
    - `name` (Company Name)
    - `slug` (auto-derived from name or customizable)
    - `address` (optional)
    - `gstin` (optional)
  - Submits to `POST /api/organizations` and calls `POST /api/organizations/set-active` to automatically switch or offer to switch to the new company.
  - Emits `onSuccess(organization)` callback so parent lists can refresh via SWR/state.

---

### Task 2: Refactor `CompanySettingsPage` into Structured Company Management Hub
- **File**: `apps/web/src/pages/CompanySettingsPage.tsx`
- **Goal**:
  - **Top Section**:
    - Page heading: "Companies & Settings" with clear description.
    - Prominent action button: **"+ Create Company"** opening `CreateCompanyDialog`.
  - **Company Overview Card / Switcher Grid**:
    - Fetch list of all user companies via SWR (`/organizations`).
    - Display companies with badges ("Active", "Owner"), GSTIN, and an instant "Switch Company" button.
  - **Active Company Configuration Tabs** (replacing the current vertical card sprawl):
    - **Tab 1: Profile**: Display name, legal address, GSTIN with clean grid layout and save status.
    - **Tab 2: SKU & Numbering**: SKU format builder with live preview, separators, and token insertion.
    - **Tab 3: Policies**: Return policy window (days), return toggle, and credit terms.
    - **Tab 4: Brands**: Product brands manager (embedded cleanly with add/edit/delete actions).

---

### Task 3: Enhance Topbar `CompanySwitcher`
- **File**: `apps/web/src/components/layout/CompanySwitcher.tsx`
- **Goal**:
  - Add a divider and a "+ New Company" action button at the bottom of the dropdown menu that triggers `CreateCompanyDialog`.
  - Allow quick creation directly from any page in the application.

---

### Task 4: Automated Testing & Verification
- **Files**:
  - `apps/web/src/components/settings/CreateCompanyDialog.test.tsx` (new test)
  - `apps/web/src/pages/CompanySettingsPage.test.tsx` (update & expand tests)
  - `apps/web/src/components/layout/CompanySwitcher.test.tsx` (update tests)
- **Goal**:
  - Test opening creation modal, form validation, and successful creation.
  - Test listing multiple companies and switching between them.
  - Ensure all 13 existing baseline tests remain green.

---

### Task 5: End-to-End Lint & Quality Check
- **Commands**:
  - `pnpm --filter @dms/web test`
  - `pnpm lint` (or repo oxlint)
