import {
  BarChart3,
  Boxes,
  FileText,
  Package,
  ReceiptText,
  RotateCw,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** The legacy sidebar's groups, with its Next.js paths carried over unchanged. */
export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
      { title: "Inventory", url: "/inventory", icon: Boxes },
      { title: "Product", url: "/product", icon: Package },
      { title: "Supplier", url: "/supplier", icon: Truck },
      { title: "Customer", url: "/customer", icon: Users },
    ],
  },
  { title: "Purchases", items: [{ title: "Purchases", url: "/purchase", icon: ShoppingCart }] },
  { title: "Invoices", items: [{ title: "Sale invoice", url: "/sale-invoice", icon: ReceiptText }] },
  { title: "Reports", items: [{ title: "Reports", url: "/reports", icon: FileText }] },
  { title: "Returns", items: [{ title: "Returns", url: "/returns", icon: RotateCw }] },
  { title: "Settings", items: [{ title: "Settings", url: "/settings", icon: Settings }] },
];
