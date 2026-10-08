import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Package,
  ReceiptText,
  RotateCw,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { cn } from "@dms/ui";

type NavItem = {
  title: string;
  icon: LucideIcon;
  to: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export const sections: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, to: "/" },
    ],
  },
  {
    label: "Daily Operations",
    items: [
      { title: "Sales & Invoices", icon: ReceiptText, to: "/sales" },
      { title: "Incoming Stock / Purchases", icon: ShoppingCart, to: "/purchases" },
      { title: "Returns & Credits", icon: RotateCw, to: "/returns" },
      { title: "Payments", icon: Wallet, to: "/payments" },
    ],
  },
  {
    label: "Stock & Catalog",
    items: [
      { title: "Product Catalog", icon: Package, to: "/products" },
      { title: "Batches & Expiry Dates", icon: CalendarClock, to: "/inventory/batches" },
      { title: "Stock Adjustments", icon: SlidersHorizontal, to: "/inventory" },
    ],
  },
  {
    label: "Contacts & Business",
    items: [
      { title: "Customers & Balances", icon: Users, to: "/customers" },
      { title: "Suppliers", icon: Truck, to: "/suppliers" },
      { title: "Performance Reports", icon: FileText, to: "/reports" },
      { title: "Team & Permissions", icon: ShieldCheck, to: "/permissions" },
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
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.name ?? "IJAZ";
  const userRole = "Administrator";

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <aside
      id="sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        isCollapsed ? "w-[72px]" : "w-[260px]",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Brand & Logo Header */}
      <div
        id="sidebar-logo"
        className="flex items-center h-16 px-4 border-b border-sidebar-border cursor-pointer select-none"
        onClick={() => handleNavigate("/")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
            <Boxes className="size-5" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-label flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">
                DMS
              </span>
              <span className="text-xs text-muted-foreground font-medium truncate">
                Distribution Management System
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <nav id="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((group) => (
          <div key={group.label} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => isMobileOpen && onCloseMobile()}
                    className={cn(
                      "nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="sidebar-label flex-1 truncate">{item.title}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile Footer */}
      <div
        className={cn(
          "sidebar-user p-3 border-t border-sidebar-border flex items-center gap-3",
          isCollapsed ? "justify-center" : ""
        )}
      >
        <div className="size-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0">
          {initials}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold truncate text-sidebar-foreground">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {userRole}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
