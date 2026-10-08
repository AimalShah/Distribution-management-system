import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import useSWR from "swr";
import { Toaster, toast } from "sonner";
import { api } from "../../lib/api";
import { AppSidebar } from "./AppSidebar";
import { Topbar, type TopbarSale, type TopbarProduct } from "./Topbar";
import { initialNotifications, type NotificationItem } from "../../data/mockData";

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("dms-theme") === "dark" || localStorage.getItem("sf_theme") === "dark";
    } catch {
      return false;
    }
  });

  useSWR("/dashboard/stats", (url) => api.get(url));
  const { data: lowStockApiData } = useSWR("/inventory/low-stock?page=1&pageSize=5", (url) => api.get(url));

  const [sales] = useState<TopbarSale[]>([]);
  const [lowStock] = useState<TopbarProduct[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  useEffect(() => {
    if (lowStockApiData?.data && lowStockApiData.data.length > 0) {
      const realAlerts: NotificationItem[] = lowStockApiData.data.slice(0, 3).map((item: any, idx: number) => ({
        id: `alert-stock-${item.id}`,
        title: "Low Stock Alert",
        desc: `${item.product?.name || "Product"} is down to ${item.quantityOnHand} units`,
        time: `${(idx + 1) * 12}m ago`,
        type: "warning",
        unread: true,
      }));

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const toAdd = realAlerts.filter((a) => !existingIds.has(a.id));

        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
      });
    }
  }, [lowStockApiData]);

  // Apply dark mode to documentElement
  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("dms-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("dms-theme", "light");
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
    toast.info(!isDark ? "Switched to Dark Mode" : "Switched to Light Mode");
  };

  const toggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  };

  const showToast = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    if (type === "success") toast.success(title, { description: message });
    else if (type === "error") toast.error(title, { description: message });
    else if (type === "warning") toast.warning(title, { description: message });
    else toast.info(title, { description: message });
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar Navigation */}
      <AppSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          id="mobile-overlay"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Content Wrapper */}
      <div
        id="main-wrapper"
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
        }`}
      >
        {/* Topbar Header */}
        <Topbar
          onToggleSidebar={toggleSidebar}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          sales={sales}
          lowStock={lowStock}
          onShowToast={showToast}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet
            context={{
              sales,
              lowStock,
              showToast,
            }}
          />
        </main>

        {/* Footer */}
        <footer className="app-footer border-t border-border py-4 px-6 text-center text-xs text-muted-foreground">
          <div className="app-footer-text">
            Copyright &copy; 2026 DMS - Distribution Management System. All rights reserved.
          </div>
        </footer>
      </div>

      {/* Accessible Toast Notifications via Sonner */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
