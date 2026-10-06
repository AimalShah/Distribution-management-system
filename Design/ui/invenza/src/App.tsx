/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { WelcomeBanner } from './components/WelcomeBanner';
import { StatsCards } from './components/StatsCards';
import { SalesChart } from './components/SalesChart';
import { RevenueBreakdown } from './components/RevenueBreakdown';
import { OverviewCards } from './components/OverviewCards';
import { CustomerChart } from './components/CustomerChart';
import { PurchaseOverview } from './components/PurchaseOverview';
import { RecentSalesTable } from './components/RecentSalesTable';
import { LowStockTable } from './components/LowStockTable';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { ReorderModal } from './components/ReorderModal';
import { AddProductModal } from './components/AddProductModal';
import { QuickReportModal } from './components/QuickReportModal';
import { ProductsView } from './components/ProductsView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { ToastContainer } from './components/ToastContainer';
import { initialSales, initialLowStock, initialNotifications } from './data/mockData';
import { SaleItem, LowStockProduct, NotificationItem, ToastMessage } from './types';
import { generateInvoicePdf } from './utils/generateInvoicePdf';

export default function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sf_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [activePage, setActivePage] = useState('dashboard');
  const [dateFilter, setDateFilter] = useState<'mtd' | 'ytd'>('mtd');

  const [sales, setSales] = useState<SaleItem[]>(initialSales);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>(initialLowStock);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  const [selectedInvoice, setSelectedInvoice] = useState<SaleItem | null>(null);
  const [reorderProduct, setReorderProduct] = useState<LowStockProduct | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Apply dark mode to documentElement
  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('sf_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('sf_theme', 'light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark((prev) => !prev);
    showToast(
      'Theme Updated',
      !isDark ? 'Switched to Dark Mode' : 'Switched to Light Mode',
      'info'
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
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
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

  const handleDateFilterChange = (filter: 'mtd' | 'ytd') => {
    setDateFilter(filter);
    showToast(
      'Date Filter',
      filter === 'mtd' ? 'Filtered: Month to Date' : 'Filtered: Year to Date',
      'info'
    );
  };

  const handleExportData = () => {
    showToast('Export', 'Exporting dashboard data...', 'info');

    // Build realistic CSV export
    let csv = 'Type,ID,Name/Customer,Date,Amount/Stock,Status\n';
    sales.forEach((s) => {
      csv += `Sale,${s.invoiceNumber},"${s.customerName}",${s.date},${s.amount},${s.status}\n`;
    });
    lowStock.forEach((p) => {
      csv += `Product,${p.sku},"${p.name}",2026-10-05,${p.currentStock},${p.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invenza-dashboard-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      showToast('Export Complete', 'Dashboard data exported to CSV successfully', 'success');
    }, 600);
  };

  const handleConfirmReorder = (productId: string, reorderQty: number) => {
    setLowStock((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newStock = item.currentStock + reorderQty;
          const newStatus =
            newStock === 0
              ? 'Out of Stock'
              : newStock <= item.minStock
              ? 'Low Stock'
              : 'Critical';
          return {
            ...item,
            currentStock: newStock,
            status: newStock > item.minStock ? 'Low Stock' : newStatus,
          };
        }
        return item;
      })
    );

    const product = lowStock.find((p) => p.id === productId);
    showToast(
      'Reorder Placed',
      `PO confirmed: +${reorderQty} units for ${product ? product.name : 'product'}`,
      'success'
    );
  };

  const handleAddProduct = (newProd: Partial<LowStockProduct>) => {
    const id = (lowStock.length + 1).toString();
    const product: LowStockProduct = {
      id,
      name: newProd.name || 'New Product',
      image: '/assets/img/products/mouse.jpg',
      sku: newProd.sku || `SKU-${Date.now()}`,
      currentStock: newProd.currentStock || 10,
      minStock: newProd.minStock || 5,
      status: (newProd.status as LowStockProduct['status']) || 'Low Stock',
      price: newProd.price || 39.99,
      category: newProd.category || 'Peripherals',
    };

    setLowStock((prev) => [product, ...prev]);
    showToast('Product Added', `Added "${product.name}" to inventory catalog`, 'success');
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleSearchResult = (type: 'invoice' | 'product' | 'page', id: string) => {
    if (type === 'invoice') {
      const sale = sales.find((s) => s.id === id);
      if (sale) {
        setSelectedInvoice(sale);
      }
    } else if (type === 'product') {
      const prod = lowStock.find((p) => p.id === id);
      if (prod) {
        setReorderProduct(prod);
      }
    } else if (type === 'page') {
      setActivePage(id);
      showToast('Navigation', `Navigated to ${id}`, 'info');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* Sidebar Component */}
      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        activePage={activePage}
        onNavigate={(page) => {
          if (page === 'add-product') {
            setIsAddProductOpen(true);
          } else if (page === 'quick-report') {
            setIsQuickReportOpen(true);
          } else {
            setActivePage(page);
          }
        }}
      />

      {/* Mobile Backdrop Overlay */}
      <div
        id="mobile-overlay"
        className={isMobileOpen ? 'show' : ''}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Main Content Wrapper */}
      <div
        id="main-wrapper"
        className={isCollapsed ? 'sidebar-collapsed' : ''}
      >
        {/* Header Component */}
        <Header
          onToggleSidebar={toggleSidebar}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          onSelectSearchResult={handleSearchResult}
          sales={sales}
          lowStock={lowStock}
          onShowToast={(title, msg, type) => showToast(title, msg, type)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          {activePage === 'dashboard' ? (
            <div className="space-y-4 md:space-y-5">
              {/* Welcome Banner */}
              <WelcomeBanner
                dateFilter={dateFilter}
                onDateFilterChange={handleDateFilterChange}
                onExport={handleExportData}
                onOpenQuickReport={() => setIsQuickReportOpen(true)}
                lowStockCount={lowStock.length}
              />

              {/* Row 1: Stats Cards */}
              <StatsCards dateFilter={dateFilter} />

              {/* Row 2: Sales Chart & Revenue Breakdown */}
              <div className="page-section grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                <SalesChart isDark={isDark} />
                <RevenueBreakdown />
              </div>

              {/* Row 3: Inventory + Users + Stock */}
              <OverviewCards />

              {/* Row 4: Customer Chart & Purchase Overview */}
              <div className="page-section grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                <CustomerChart isDark={isDark} />
                <PurchaseOverview />
              </div>

              {/* Row 5: Recent Sales Table */}
              <RecentSalesTable
                sales={sales}
                onViewInvoice={(sale) => setSelectedInvoice(sale)}
                onViewAllSales={() => setActivePage('invoices')}
              />

              {/* Row 6: Low Stock Products Table */}
              <LowStockTable
                products={lowStock}
                onReorder={(prod) => setReorderProduct(prod)}
                onViewAllProducts={() => setActivePage('products')}
              />
            </div>
          ) : activePage === 'products' ? (
            <ProductsView
              products={lowStock}
              onBackToDashboard={() => setActivePage('dashboard')}
              onOpenAddProduct={() => setIsAddProductOpen(true)}
              onReorder={(prod) => setReorderProduct(prod)}
            />
          ) : activePage === 'invoices' || activePage === 'all-sales' ? (
            <InvoicesView
              sales={sales}
              onBackToDashboard={() => setActivePage('dashboard')}
              onViewInvoice={(sale) => setSelectedInvoice(sale)}
            />
          ) : activePage === 'customers' ? (
            <CustomersView onBackToDashboard={() => setActivePage('dashboard')} />
          ) : (
            <div className="card p-8 text-center animate-slideInUp">
              <h2 className="text-xl font-bold text-[var(--text)] mb-2 capitalize">
                {activePage.replace('-', ' ')}
              </h2>
              <p className="text-[var(--muted)] text-sm mb-5">
                Detailed view and management for {activePage.replace('-', ' ')}.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="btn btn-primary btn-sm cursor-pointer"
              >
                ← Return to Dashboard
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="app-footer-text">Copyright &copy; 2026 Invenza All rights reserved.</div>
        </footer>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          sale={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPrint={(invNum) => {
            try {
              const doc = generateInvoicePdf(selectedInvoice);
              doc.save(`invoice-${invNum}.pdf`);
              showToast('Invoice Exported', `Generated and downloaded PDF for ${invNum}`, 'success');
            } catch (err) {
              console.error(err);
              showToast('Print Error', `Could not generate PDF for ${invNum}`, 'info');
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
        currentDateFilter={dateFilter}
        onShowToast={(title, msg, type) => showToast(title, msg, type)}
      />

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
