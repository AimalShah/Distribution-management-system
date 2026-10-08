import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { Toaster, toast } from "sonner";
import { api } from "../../lib/api";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { initialNotifications, type NotificationItem } from "../../data/mockData";
import { cn } from "@dms/ui";

export function AppShell() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("dms-theme") === "dark";
    } catch {
      return false;
    }
  });

  useSWR("/dashboard/stats", (url) => api.get(url));
  const { data: lowStockApiData } = useSWR("/inventory/low-stock?page=1&pageSize=5", (url) => api.get(url));

  const [sales] = useState<any[]>([]);
  const [lowStock] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  useEffect(() => {
    if (lowStockApiData?.data && lowStockApiData.data.length > 0) {
      const realAlerts: NotificationItem[] = lowStockApiData.data.slice(0, 3).map((item: any, idx: number) => ({
        id: `alert-stock-${item.id}`,
        title: "Low Stock Alert",
        desc: `${item.product?.name || "Product"} is down to ${item.quantityOnHand} units`,
        time: `${(idx + 1) * 12}m ago`,
        type: "warning" as const,
        unread: true,
      }));

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const toAdd = realAlerts.filter((a) => !existingIds.has(a.id));
        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
      });
    }
  }, [lowStockApiData]);

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

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex">
      {/* Sidebar */}
      <AppSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main wrapper */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-200",
          isCollapsed ? "lg:ml-[72px]" : "lg:ml-[240px]"
        )}
      >
        {/* Topbar */}
        <Topbar
          onToggleSidebar={toggleSidebar}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          unreadCount={unreadCount}
          sales={sales}
          lowStock={lowStock}
          onShowToast={showToast}
        />

        {/* Content */}
        <main className="flex-1 p-5 md:p-8 max-w-[1280px] w-full mx-auto">
          <Outlet
            context={{
              sales,
              lowStock,
              showToast,
            }}
          />
        </main>

        {/* Footer */}
        <footer className="border-t border-stone-200 py-3 px-6 text-center text-xs text-stone-400">
          DistroManager &copy; 2026
        </footer>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
