import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import useSWR from "swr";
import { api } from "../../lib/api";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { InvoiceDetailModal } from "../invenza/InvoiceDetailModal";
import { ReorderModal } from "../invenza/ReorderModal";
import { AddProductModal } from "../invenza/AddProductModal";
import { QuickReportModal } from "../invenza/QuickReportModal";
import { ToastContainer } from "../invenza/ToastContainer";
import { initialSales, initialLowStock, initialNotifications } from "../../data/mockData";
import { SaleItem, LowStockProduct, NotificationItem, ToastMessage } from "../../types/invenza";
import { generateInvoicePdf } from "../../utils/generateInvoicePdf";

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sf_theme") === "dark";
    } catch {
      return false;
    }
  });

  const { data: statsData } = useSWR("/dashboard/stats", (url) => api.get(url).then((r) => r.data));
  const { data: lowStockApiData } = useSWR("/inventory/low-stock?page=1&pageSize=5", (url) => api.get(url).then((r) => r.data));

  const [sales, setSales] = useState<SaleItem[]>(initialSales);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>(initialLowStock);
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

  const [selectedInvoice, setSelectedInvoice] = useState<SaleItem | null>(null);
  const [reorderProduct, setReorderProduct] = useState<LowStockProduct | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply dark mode to documentElement
  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("sf_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("sf_theme", "light");
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
    showToast(
      "Theme Updated",
      !isDark ? "Switched to Dark Mode" : "Switched to Light Mode",
      "info"
    );
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
    const id = Date.now().toString() + Math.random().toString();
    const newToast: ToastMessage = { id, title, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleConfirmReorder = (productId: string, reorderQty: number) => {
    setLowStock((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newStock = item.currentStock + reorderQty;
          return {
            ...item,
            currentStock: newStock,
            status: newStock > item.minStock ? "Low Stock" : item.status,
          };
        }
        return item;
      })
    );

    const product = lowStock.find((p) => p.id === productId);
    showToast(
      "Reorder Placed",
      `PO confirmed: +${reorderQty} units for ${product ? product.name : "product"}`,
      "success"
    );
  };

  const handleAddProduct = (newProd: Partial<LowStockProduct>) => {
    const id = (lowStock.length + 1).toString();
    const product: LowStockProduct = {
      id,
      name: newProd.name || "New Product",
      image: "/assets/img/products/mouse.jpg",
      sku: newProd.sku || `SKU-${Date.now()}`,
      currentStock: newProd.currentStock || 10,
      minStock: newProd.minStock || 5,
      status: (newProd.status as LowStockProduct["status"]) || "Low Stock",
      price: newProd.price || 39.99,
      category: newProd.category || "Peripherals",
    };

    setLowStock((prev) => [product, ...prev]);
    showToast("Product Added", `Added "${product.name}" to inventory catalog`, "success");
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleSearchResult = (type: "invoice" | "product" | "page", id: string) => {
    if (type === "invoice") {
      const sale = sales.find((s) => s.id === id);
      if (sale) {
        setSelectedInvoice(sale);
      }
    } else if (type === "product") {
      const prod = lowStock.find((p) => p.id === id);
      if (prod) {
        setReorderProduct(prod);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* Invenza Sidebar Component */}
      <AppSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenQuickReport={() => setIsQuickReportOpen(true)}
      />

      {/* Mobile Backdrop Overlay */}
      <div
        id="mobile-overlay"
        className={isMobileOpen ? "show" : ""}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Main Content Wrapper */}
      <div id="main-wrapper" className={isCollapsed ? "sidebar-collapsed" : ""}>
        {/* Invenza Header / Topbar Component */}
        <Topbar
          onToggleSidebar={toggleSidebar}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          onSelectSearchResult={handleSearchResult}
          sales={sales}
          lowStock={lowStock}
          onShowToast={showToast}
          onOpenQuickReport={() => setIsQuickReportOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet
            context={{
              sales,
              lowStock,
              onOpenInvoice: setSelectedInvoice,
              onOpenReorder: setReorderProduct,
              onOpenAddProduct: () => setIsAddProductOpen(true),
              onOpenQuickReport: () => setIsQuickReportOpen(true),
              showToast,
            }}
          />
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="app-footer-text">
            Copyright &copy; 2026 DMS All rights reserved.
          </div>
        </footer>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          sale={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPrint={(saleCode) => {
            try {
              const doc = generateInvoicePdf(selectedInvoice);
              doc.save(`invoice-${saleCode}.pdf`);
              showToast("Invoice Exported", `Generated and downloaded PDF for ${saleCode}`, "success");
            } catch (err) {
              console.error(err);
              showToast("Print Error", `Could not generate PDF for ${saleCode}`, "info");
            }
          }}
        />
      )}

      {/* Reorder Modal */}
      {reorderProduct && (
        <ReorderModal
          product={reorderProduct}
          onClose={() => setReorderProduct(null)}
          onConfirmReorder={handleConfirmReorder}
        />
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAddProduct={handleAddProduct}
      />

      {/* Quick Report Modal */}
      <QuickReportModal
        isOpen={isQuickReportOpen}
        onClose={() => setIsQuickReportOpen(false)}
        sales={sales}
        lowStock={lowStock}
        currentDateFilter="mtd"
        onShowToast={showToast}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
