/**
 * Checkpoint 13 — Invenza UI Theme, Chrome & Dashboard Redesign: Parity Test
 *
 * Scope: asserts the complete structural, styling, and behavioral parity
 * with the Invenza Inventory Management Dashboard specification:
 *
 *   - Invenza CSS custom properties, color palette (#22B573), dark mode, and classes;
 *   - Sidebar branding, collapsible behavior, categorized groups, submenus, and user profile;
 *   - Topbar search with dropdown, notifications with badge, theme toggle, and user menu;
 *   - AppShell structure with mobile overlay, main wrapper, footer, and modal providers;
 *   - Executive dashboard widgets: WelcomeBanner, StatsCards, SalesChart, RevenueBreakdown,
 *     OverviewCards, CustomerChart, PurchaseOverview, RecentSalesTable, LowStockTable;
 *   - Modals: InvoiceDetailModal, ReorderModal, AddProductModal, QuickReportModal, ToastContainer;
 *   - PDF generation engines for invoices and executive audit reports;
 *   - Static product and avatar assets in public directory;
 *   - Zero occurrences of unbacked legacy field names (invoiceNumber, purchaseOrderNumber).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");

const read = (relative: string) => {
  const full = path.join(root, relative);
  expect(fs.existsSync(full), `${relative} should exist`).toBe(true);
  return fs.readFileSync(full, "utf-8");
};

describe("Checkpoint 13 — Invenza UI Dashboard Redesign", () => {
  it("includes Invenza design system stylesheet and CSS variables", () => {
    const css = read("apps/web/src/invenza.css");
    const indexCss = read("apps/web/src/index.css");

    // Must be imported into main stylesheet
    expect(indexCss).toContain("./invenza.css");

    // Palette custom properties
    expect(css).toContain("--primary: #22B573");
    expect(css).toContain("--primary-dark: #15945A");
    expect(css).toContain("--primary-light: #EAF8F1");
    expect(css).toContain("--sidebar-width: 260px");
    expect(css).toContain("--sidebar-collapsed-width: 72px");

    // Dark mode overrides
    expect(css).toContain("--background: #0F172A");
    expect(css).toContain("--surface: #1E293B");

    // Core layout classes
    expect(css).toContain("#sidebar");
    expect(css).toContain("#main-wrapper");
    expect(css).toContain("#app-header");
    expect(css).toContain(".nav-item");
    expect(css).toContain(".submenu");
    expect(css).toContain(".card");
    expect(css).toContain(".badge");
    expect(css).toContain(".data-table");
  });

  it("renders Invenza sidebar chrome with navigation sections and branding", () => {
    const sidebar = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Brand and Logo
    expect(sidebar).toContain("DMS");
    expect(sidebar).toContain("Inventory Management");
    expect(sidebar).toContain("linear-gradient(135deg,#22B573 0%,#16A34A 100%)");

    // Navigation sections
    expect(sidebar).toContain("MAIN");
    expect(sidebar).toContain("INVENTORY");
    expect(sidebar).toContain("Purchases");
    expect(sidebar).toContain("Sales");
    expect(sidebar).toContain("CRM");
    expect(sidebar).toContain("ANALYTICS");
    expect(sidebar).toContain("ADMIN");

    // Submenu structure with +/- toggles
    expect(sidebar).toContain("submenu-toggle");
    expect(sidebar).toContain("nav-toggle-icon");
    expect(sidebar).toContain("openSubmenus");

    // User profile footer
    expect(sidebar).toContain("sidebar-user");
    expect(sidebar).toContain("IJAZ");
    expect(sidebar).toContain("Administrator");
  });

  it("renders Invenza topbar header with search, notifications, and theme switch", () => {
    const topbar = read("apps/web/src/components/layout/Topbar.tsx");

    // Sidebar trigger
    expect(topbar).toContain("sidebar-toggle-btn");

    // Global Search with dropdown
    expect(topbar).toContain("global-search-input");
    expect(topbar).toContain("search-results-dropdown");

    // Notifications bell
    expect(topbar).toContain("notifications-btn");
    expect(topbar).toContain("notifications-dropdown");

    // Theme Switch
    expect(topbar).toContain("theme-toggle-btn");

    // User menu
    expect(topbar).toContain("IJAZ");
    expect(topbar).toContain("alex.morgan@inventioo.test");
  });

  it("provides AppShell with Invenza layout, footer, and modals", () => {
    const shell = read("apps/web/src/components/layout/AppShell.tsx");

    expect(shell).toContain("<AppSidebar");
    expect(shell).toContain("<Topbar");
    expect(shell).toContain("mobile-overlay");
    expect(shell).toContain("main-wrapper");
    expect(shell).toContain("Copyright &copy; 2026 DMS All rights reserved.");

    // Modals mounted
    expect(shell).toContain("InvoiceDetailModal");
    expect(shell).toContain("ReorderModal");
    expect(shell).toContain("AddProductModal");
    expect(shell).toContain("QuickReportModal");
    expect(shell).toContain("ToastContainer");
  });

  it("renders all Invenza dashboard widgets on Dashboard page", () => {
    const dashboard = read("apps/web/src/pages/Dashboard.tsx");

    expect(dashboard).toContain("<WelcomeBanner");
    expect(dashboard).toContain("<StatsCards");
    expect(dashboard).toContain("<InvenzaSalesChart");
    expect(dashboard).toContain("<RevenueBreakdown");
    expect(dashboard).toContain("<OverviewCards");
    expect(dashboard).toContain("<CustomerChart");
    expect(dashboard).toContain("<PurchaseOverview");
    expect(dashboard).toContain("<RecentSalesTable");
    expect(dashboard).toContain("<LowStockTable");
  });

  it("provides modal components and PDF generators", () => {
    // Component modules exist
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza/InvoiceDetailModal.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza/ReorderModal.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza/AddProductModal.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza/QuickReportModal.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza/ToastContainer.tsx"))).toBe(true);

    // PDF generation utilities exist
    expect(fs.existsSync(path.join(root, "apps/web/src/utils/generateInvoicePdf.ts"))).toBe(true);
    expect(fs.existsSync(path.join(root, "apps/web/src/utils/generateQuickReportPdf.ts"))).toBe(true);

    const invoicePdf = read("apps/web/src/utils/generateInvoicePdf.ts");
    expect(invoicePdf).toContain("generateInvoicePdf");
    expect(invoicePdf).toContain("INVENZA");

    const reportPdf = read("apps/web/src/utils/generateQuickReportPdf.ts");
    expect(reportPdf).toContain("generateQuickReportPdf");
    expect(reportPdf).toContain("Executive Inventory Health & Sales Performance Summary");
  });

  it("verifies public static assets for avatars and products", () => {
    const avatarFiles = ["1.jpg", "2.jpg", "3.jpg"];
    for (const file of avatarFiles) {
      expect(
        fs.existsSync(path.join(root, `apps/web/public/assets/img/avator/${file}`)),
        `Avatar asset ${file} should exist`
      ).toBe(true);
    }

    const productFiles = ["headphone.jpg", "powerbank.jpg", "mouse.jpg", "speeker.jpg"];
    for (const file of productFiles) {
      expect(
        fs.existsSync(path.join(root, `apps/web/public/assets/img/products/${file}`)),
        `Product asset ${file} should exist`
      ).toBe(true);
    }
  });

  it("strictly enforces zero occurrences of legacy unbacked field names", () => {
    const webSrc = path.join(root, "apps/web/src");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");
          if (/invoiceNumber|purchaseOrderNumber/.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(webSrc);

    expect(
      offenders,
      `Unbacked legacy field names (invoiceNumber, purchaseOrderNumber) found in: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
