import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  RotateCcw,
  Wallet,
  Package,
  CalendarClock,
  SlidersHorizontal,
  Users,
  Truck,
  FileText,
  ShieldCheck,
  Box,
  Building2,
} from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

export const navSections: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Sales & Invoices", icon: ReceiptText, to: "/sales" },
      { label: "Purchases", icon: ShoppingCart, to: "/purchases" },
      { label: "Returns", icon: RotateCcw, to: "/returns" },
      { label: "Payments", icon: Wallet, to: "/payments" },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { label: "Products", icon: Package, to: "/products" },
      { label: "Stock Adjustments", icon: SlidersHorizontal, to: "/inventory" },
      { label: "Batches", icon: CalendarClock, to: "/inventory/batches" },
    ],
  },
  {
    heading: "Contacts",
    items: [
      { label: "Customers", icon: Users, to: "/customers" },
      { label: "Suppliers", icon: Truck, to: "/suppliers" },
    ],
  },
  {
    heading: "Reports",
    items: [
      { label: "Analytics", icon: FileText, to: "/reports" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "Team", icon: Users, to: "/users" },
      { label: "Companies", icon: Building2, to: "/settings/company" },
      { label: "Permissions", icon: ShieldCheck, to: "/permissions" },
      { label: "Profile", icon: Box, to: "/profile" },
    ],
  },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({
  isCollapsed = false,
  isMobileOpen = false,
  onCloseMobile = () => {},
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.name ?? "User";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (to: string) => {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-stone-200 bg-stone-100 text-stone-700 transition-all duration-200 ${
        isCollapsed ? "w-[72px]" : "w-[240px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      {/* Brand */}
      <div
        className="flex items-center h-14 px-3 border-b border-stone-200 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-stone-900 font-bold text-sm shrink-0">
            D
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-stone-900 leading-tight">
                DistroManager
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {navSections.map((group) => (
          <div key={group.heading}>
            {!isCollapsed && (
              <div className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                {group.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      navigate(item.to);
                      if (isMobileOpen) onCloseMobile();
                    }}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.to)
                        ? "bg-amber-500/10 text-amber-700 font-semibold"
                        : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-stone-400 data-[active]:text-amber-600" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={`p-2 border-t border-stone-200 flex items-center gap-3 ${
        isCollapsed ? "justify-center" : ""
      }`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-stone-900 font-bold text-xs shrink-0">
          {initials}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-stone-900 truncate">{displayName}</span>
            <span className="text-[11px] text-stone-400 truncate">Administrator</span>
          </div>
        )}
      </div>
    </aside>
  );
}
