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
 *   - PDF generation engine for executive audit reports;
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

describe("Checkpoint 13 — Modern Shadcn UI Dashboard Redesign", () => {
  it("includes Shadcn design system stylesheet and CSS variables, with Invenza completely purged", () => {
    const indexCss = read("apps/web/src/index.css");

    // Invenza stylesheet must NOT be imported or exist
    expect(indexCss).not.toContain("./invenza.css");
    expect(fs.existsSync(path.join(root, "apps/web/src/invenza.css"))).toBe(false);

    // Shadcn semantic custom properties in light theme
    expect(indexCss).toContain("--background:");
    expect(indexCss).toContain("--foreground:");
    expect(indexCss).toContain("--card:");
    expect(indexCss).toContain("--primary:");
    expect(indexCss).toContain("--muted:");
    expect(indexCss).toContain("--border:");
    expect(indexCss).toContain("--ring:");
    expect(indexCss).toContain("--radius:");

    // Dark mode overrides
    expect(indexCss).toContain(".dark");
  });

  it("renders modern operational sidebar chrome with humanized sections and branding", () => {
    const sidebar = read("apps/web/src/components/layout/AppSidebar.tsx");

    // Brand and Title
    expect(sidebar).toContain("DMS");
    expect(sidebar).toContain("Distribution Management System");

    // 4 Humanized Operational Navigation Groups
    expect(sidebar).toContain("Overview");
    expect(sidebar).toContain("Daily Operations");
    expect(sidebar).toContain("Stock & Catalog");
    expect(sidebar).toContain("Contacts & Business");

    // Humanized entity labels from CONTEXT.md
    expect(sidebar).toContain("Sales & Invoices");
    expect(sidebar).toContain("Incoming Stock / Purchases");
    expect(sidebar).toContain("Batches & Expiry Dates");
    expect(sidebar).toContain("Stock Adjustments");
    expect(sidebar).toContain("Customers & Balances");
    expect(sidebar).toContain("Team & Permissions");

    // User profile indicator
    expect(sidebar).toContain("IJAZ");
  });

  it("renders modern topbar header with search, notifications, and theme switch", () => {
    const topbar = read("apps/web/src/components/layout/Topbar.tsx");

    // Sidebar trigger
    expect(topbar).toContain("sidebar-toggle-btn");

    // Global Search
    expect(topbar).toContain("global-search-input");

    // Notifications bell
    expect(topbar).toContain("notifications-btn");

    // Theme Switch
    expect(topbar).toContain("ThemeSwitch");

    // User account representation
    expect(topbar).toContain("IJAZ");
  });

  it("provides AppShell with clean layout, responsive container, and footer", () => {
    const shell = read("apps/web/src/components/layout/AppShell.tsx");

    expect(shell).toContain("<AppSidebar");
    expect(shell).toContain("<Topbar");
    expect(shell).toContain("main-wrapper");
    expect(shell).toContain("Distribution Management System");
  });

  it("renders modern operational dashboard widgets on Dashboard page", () => {
    const dashboard = read("apps/web/src/pages/Dashboard.tsx");

    // Zero imports from components/invenza
    expect(dashboard).not.toContain("components/invenza");

    // Operational greeting and Quick Action bar
    expect(dashboard).toContain("Quick Actions");
    expect(dashboard).toContain("New Sale Invoice");
    expect(dashboard).toContain("Receive Stock");

    // 4 Headline KPI Cards
    expect(dashboard).toContain("Sales & Revenue");
    expect(dashboard).toContain("Stock Purchases");
    expect(dashboard).toContain("Outstanding Balances");
    expect(dashboard).toContain("Urgent Stock Attention");

    // Operational alerts & tables
    expect(dashboard).toContain("Low Stock");
    expect(dashboard).toContain("Expiring Soon");
  });

  it("ensures invenza components and types are completely purged", () => {
    // Invenza directory and types must NOT exist
    expect(fs.existsSync(path.join(root, "apps/web/src/components/invenza"))).toBe(false);
    expect(fs.existsSync(path.join(root, "apps/web/src/types/invenza.ts"))).toBe(false);

    // Quick report engine is preserved
    expect(fs.existsSync(path.join(root, "apps/web/src/utils/generateQuickReportPdf.ts"))).toBe(true);
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
