# Checkpoint 13 — Invenza UI Theme, Chrome & Dashboard Redesign: Plan

## Goal

Transform the web client UI pages, sidebar, topbar header, modals, dashboard widgets, and design system to match the Invenza Inventory Management Dashboard specification (`Design/ui/invenza---inventory-management-dashboard.zip`).

## Scope & Architectural Alignment

1. **Design System & Stylesheet**:
   - Invenza CSS custom properties:
     - Primary brand: `#22B573` (emerald green)
     - Primary dark: `#15945A`, light accent: `#EAF8F1`
     - Background: `#F6F8FA`, Surface: `#FFFFFF`, Border: `#E8EDF1`, Text: `#17212B`, Muted: `#6B7280`
     - Dark theme support: Background `#0F172A`, Surface `#1E293B`, Border `#334155`, Text `#F1F5F9`
     - Typography: Inter & JetBrains Mono fonts
     - Card styling with hover elevation, status badges (`badge-success`, `badge-warning`, `badge-danger`, `badge-info`)
     - Responsive sidebar layout (`#sidebar`, `#main-wrapper`, `.sidebar-collapsed`, `#mobile-overlay`)

2. **Invenza Chrome & Navigation**:
   - Sidebar (`apps/web/src/components/layout/AppSidebar.tsx`):
     - Invenza diamond/cube logo with gradient `#22B573` -> `#16A34A`
     - Brand title: "Invenza - Inventory Management"
     - Collapsible support (260px expanded, 72px icon rail)
     - Categorized navigation groups: MAIN, INVENTORY, PURCHASES, SALES, CRM, ANALYTICS, ADMIN, Settings
     - Animated submenus with expand/collapse `+`/`-` toggle icons
     - Bottom administrator profile card ("Alex Morgan", "Administrator")
     - Preserves parity contract entries for Settings, Users, and Permissions
   - Topbar Header (`apps/web/src/components/layout/Topbar.tsx`):
     - Hamburger toggle button for sidebar collapse / mobile drawer
     - Global search box with dropdown searching catalog products and recent sales/invoices
     - Quick Report (PDF) action button
     - Notification bell with unread badge counter, and notifications dropdown with "Mark all as read"
     - Sun/Moon theme switch toggle button (syncing `localStorage.setItem('sf_theme')`)
     - User account dropdown (Profile, Team & Users, Billing, Sign Out)
   - Layout Shell (`apps/web/src/components/layout/AppShell.tsx`):
     - Invenza chrome wrapper, mobile overlay, persistent layout state
     - Footer: "Copyright © 2026 Invenza All rights reserved."

3. **Invenza Executive Dashboard** (`apps/web/src/pages/Dashboard.tsx`):
   - Welcome Banner:
     - "Welcome back, John! 👋" (or Admin)
     - Real-time inventory overview and low stock alert counter
     - MTD (Month-to-Date) and YTD (Year-to-Date) active period toggle buttons
     - Instant Quick Report (PDF) modal trigger
     - Export Data button (CSV generation and download)
   - Row 1: KPI Stats Cards (Total Sales, Revenue, Cost, Profit with trend percentages and progress indicators)
   - Row 2: Interactive Sales & Revenue Chart (daily, weekly, monthly periods) and Revenue Breakdown card
   - Row 3: Overview Cards (Inventory overview with Qty in hand vs Will be received, User overview, Stock overview)
   - Row 4: Customer Growth bar chart and Purchase Overview with PO breakdown and progress meters
   - Row 5: Recent Sales Table with customer avatars, payment method pills, status badges, and View Details action
   - Row 6: Low Stock Products Table with product thumbnail, SKU, current stock, min stock, status, and Reorder modal action
   - Multi-tab toggle: Invenza Executive View + Live Operational Telemetry view

4. **Interactive Modals & PDF Engines**:
   - `InvoiceDetailModal`: Renders customer details, payment method, line item breakdown, subtotal, tax, grand total, and "Print / Download PDF"
   - `ReorderModal`: Restock purchase order dialog with supplier selection, quantity stepper, and unit/total cost estimation
   - `AddProductModal`: Fast product creation with name, SKU, category, price, opening stock, and min stock
   - `QuickReportModal`: Instant executive summary dialog with period selection, section checkboxes, notes, and PDF generation
   - `ToastContainer`: Floating bottom-right toast notifications for feedback
   - `generateInvoicePdf`: Professional A4 invoice generation using jsPDF & autoTable with Invenza styling
   - `generateQuickReportPdf`: Multi-section operational audit PDF report

5. **Static Assets & Public Directory**:
   - Customer avatars: `public/assets/img/avator/{1,2,3}.jpg`
   - Product imagery: `public/assets/img/products/{headphone,powerbank,mouse,speeker}.jpg`

6. **Safety & Domain Contract**:
   - Strict adherence to zero unbacked legacy field names (`invoiceNumber`, `purchaseOrderNumber`)
