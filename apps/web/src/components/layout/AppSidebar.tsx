import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  ReceiptText,
  RotateCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

type NavItem = {
  title: string;
  icon: LucideIcon;
  to?: string;
};

/**
 * The information architecture, in the order the legacy and Invenza sidebars show it.
 * Pinned for parity tests.
 */
export const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, to: "/" },
      { title: "Inventory", icon: Boxes, to: "/inventory" },
      { title: "Products", icon: Package, to: "/products" },
      { title: "Suppliers", icon: Truck, to: "/suppliers" },
      { title: "Customers", icon: Users, to: "/customers" },
    ],
  },
  { label: "Purchases", items: [{ title: "Purchases", icon: ShoppingCart, to: "/purchases" }] },
  { label: "Invoices", items: [{ title: "Sale invoices", icon: ReceiptText, to: "/sales" }] },
  { label: "Reports", items: [{ title: "Reports", icon: FileText, to: "/reports" }] },
  { label: "Returns", items: [{ title: "Returns", icon: RotateCw, to: "/returns" }] },
  {
    label: "Settings",
    items: [
      { title: "Users", icon: Users, to: "/users" },
      { title: "Permissions", icon: ShieldCheck, to: "/permissions" },
    ],
  },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenQuickReport?: () => void;
}

export function AppSidebar({
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile = () => {},
  onOpenQuickReport,
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.name ?? "IJAZ";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({
    inventory: pathname.startsWith("/inventory") || pathname.startsWith("/products"),
    purchases: pathname.startsWith("/purchases"),
    sales: pathname.startsWith("/sales"),
    reports: pathname.startsWith("/reports"),
    users: pathname.startsWith("/users") || pathname.startsWith("/permissions"),
    settings: pathname.startsWith("/settings"),
  });

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <aside
      id="sidebar"
      className={`${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
    >
      {/* Sidebar Logo */}
      <div
        id="sidebar-logo"
        className="flex items-center h-16 px-4 border-b cursor-pointer select-none"
        style={{
          borderColor: "var(--border)",
          flexShrink: 0,
          textDecoration: "none",
          transition: "background 0.15s",
        }}
        onClick={() => handleNavigate("/")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#22B573 0%,#16A34A 100%)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="white" fillOpacity="0.2" />
              <path
                d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M12 22V12" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M3 7l9 5 9-5" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.5" fill="white" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>
          <div
            className="sidebar-label"
            style={{ borderLeft: "1px solid var(--border)", paddingLeft: "12px" }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text)",
                lineHeight: 1.1,
                letterSpacing: "-0.3px",
              }}
            >
              DMS
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--primary)",
                fontWeight: 600,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                marginTop: "4px",
              }}
            >
              Inventory Management
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Nav */}
      <nav id="sidebar-nav" className="flex-1 overflow-y-auto py-3 px-3" style={{ gap: "4px" }}>
        <div className="sidebar-section-label">MAIN</div>

        <NavLink
          to="/"
          onClick={() => isMobileOpen && onCloseMobile()}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Dashboard</span>
        </NavLink>

        <div className="sidebar-section-label">INVENTORY</div>

        {/* Inventory Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("inventory")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Inventory</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.inventory ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.inventory ? "open" : ""}`}>
            <NavLink
              to="/products"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Products
            </NavLink>
            <NavLink
              to="/products/new"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Add Product
            </NavLink>
            <NavLink
              to="/inventory"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Categories &amp; Stock
            </NavLink>
          </div>
        </div>

        {/* Purchases Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("purchases")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Purchases</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.purchases ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.purchases ? "open" : ""}`}>
            <NavLink
              to="/purchases"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              All Purchases
            </NavLink>
            <NavLink
              to="/purchases/new"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Add Purchase
            </NavLink>
            <NavLink
              to="/returns"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Purchase Returns
            </NavLink>
          </div>
        </div>

        {/* Sales Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("sales")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Sales</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.sales ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.sales ? "open" : ""}`}>
            <NavLink
              to="/sales"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              All Sales
            </NavLink>
            <NavLink
              to="/sales/new"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Point of Sale
            </NavLink>
            <NavLink
              to="/returns"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Sales Returns
            </NavLink>
          </div>
        </div>

        {/* Invoices */}
        <NavLink
          to="/sales"
          onClick={() => isMobileOpen && onCloseMobile()}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Invoices</span>
        </NavLink>

        <div className="sidebar-section-label">CRM</div>

        {/* Customers */}
        <NavLink
          to="/customers"
          onClick={() => isMobileOpen && onCloseMobile()}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Customers</span>
        </NavLink>

        {/* Suppliers */}
        <NavLink
          to="/suppliers"
          onClick={() => isMobileOpen && onCloseMobile()}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <svg
            className="flex-shrink-0"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span className="sidebar-label flex-1 text-left">Suppliers</span>
        </NavLink>

        <div className="sidebar-section-label">ANALYTICS</div>

        {/* Reports Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("reports")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Reports</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.reports ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.reports ? "open" : ""}`}>
            {onOpenQuickReport && (
              <button
                type="button"
                onClick={() => {
                  onOpenQuickReport();
                  if (isMobileOpen) onCloseMobile();
                }}
                className="submenu-item w-full text-left font-medium text-primary-strong cursor-pointer"
              >
                Quick Reports (PDF)
              </button>
            )}
            <NavLink
              to="/reports"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              All Reports
            </NavLink>
          </div>
        </div>

        <div className="sidebar-section-label">ADMIN</div>

        {/* Users Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("users")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Users</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.users ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.users ? "open" : ""}`}>
            <NavLink
              to="/users"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              All Users
            </NavLink>
            <NavLink
              to="/permissions"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Roles &amp; Permissions
            </NavLink>
          </div>
        </div>

        {/* Settings Submenu */}
        <div className="submenu-group">
          <button
            type="button"
            className="nav-item submenu-toggle"
            onClick={() => toggleSubmenu("settings")}
          >
            <svg
              className="flex-shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M2 12h2M20 12h2M6.34 5.34L4.93 4.93M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M18.66 6.34l-1.41 1.41M6.34 18.66l-1.41 1.41" />
            </svg>
            <span className="sidebar-label flex-1 text-left">Settings</span>
            <span className="nav-toggle-icon sidebar-label">
              {openSubmenus.settings ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </span>
          </button>
          <div className={`submenu ${openSubmenus.settings ? "open" : ""}`}>
            <NavLink
              to="/settings/profile"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              General Profile
            </NavLink>
            <NavLink
              to="/settings/billing"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Billing &amp; Subscription
            </NavLink>
            <NavLink
              to="/settings/permissions"
              onClick={() => isMobileOpen && onCloseMobile()}
              className={({ isActive }) => `submenu-item w-full text-left ${isActive ? "active" : ""}`}
            >
              Permissions
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Sidebar User Profile */}
      <div id="sidebar-user" className="p-3 border-t" style={{ borderColor: "var(--border)", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => handleNavigate("/profile")}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--background)] transition-colors w-full text-left border-none bg-transparent cursor-pointer"
        >
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: "var(--primary)" }}
          >
            {initials}
          </div>
          <div className="sidebar-label min-w-0">
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.name ?? "IJAZ"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>Administrator</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
