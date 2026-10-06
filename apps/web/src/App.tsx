import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/auth/RequireAuth";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ProductList from "./pages/ProductList";
import ProductNew from "./pages/ProductNew";
import ProductEdit from "./pages/ProductEdit";
import PurchaseList from "./pages/PurchaseList";
import PurchaseNew from "./pages/PurchaseNew";
import PurchaseEdit from "./pages/PurchaseEdit";
import SaleInvoiceList from "./pages/SaleInvoiceList";
import SaleInvoiceNew from "./pages/SaleInvoiceNew";
import SaleInvoiceEdit from "./pages/SaleInvoiceEdit";
import InventoryPage from "./pages/InventoryPage";
import ReturnList from "./pages/ReturnList";
import ReturnNew from "./pages/ReturnNew";
import CustomerList from "./pages/CustomerList";
import CustomerLedgerPage from "./pages/CustomerLedgerPage";
import PaymentsPage from "./pages/PaymentsPage";
import SupplierList from "./pages/SupplierList";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import UsersPage from "./pages/UsersPage";
import BillingPage from "./pages/BillingPage";
import PermissionPage from "./pages/PermissionPage";

export function App() {
  return (
    <Routes>
      {/* Outside the guard on purpose: it is the one page reachable signed out. */}
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new" element={<ProductNew />} />
          <Route path="/products/:id/edit" element={<ProductEdit />} />

          {/* Customer routes */}
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id/ledger" element={<CustomerLedgerPage />} />

          {/* Payment routes */}
          <Route path="/payments" element={<PaymentsPage />} />

          {/* Supplier routes */}
          <Route path="/suppliers" element={<SupplierList />} />

          {/* Purchase routes */}
          <Route path="/purchases" element={<PurchaseList />} />
          <Route path="/purchases/new" element={<PurchaseNew />} />
          <Route path="/purchases/:id/edit" element={<PurchaseEdit />} />

          {/* Sale Invoice routes */}
          <Route path="/sales" element={<SaleInvoiceList />} />
          <Route path="/sales/new" element={<SaleInvoiceNew />} />
          <Route path="/sales/:id/edit" element={<SaleInvoiceEdit />} />

          {/* Return routes */}
          <Route path="/returns" element={<ReturnList />} />
          <Route path="/returns/new" element={<ReturnNew />} />

          {/* Report routes */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Settings & Admin routes */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings/users" element={<UsersPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings/billing" element={<BillingPage />} />
          <Route path="/permissions" element={<PermissionPage />} />
          <Route path="/permission" element={<PermissionPage />} />
          <Route path="/settings/permissions" element={<PermissionPage />} />
          <Route path="/settings/permission" element={<PermissionPage />} />

          {/* Legacy route compatibility */}
          <Route path="/user" element={<Navigate to="/users" replace />} />
          <Route path="/report" element={<Navigate to="/reports" replace />} />
          <Route path="/supplier" element={<Navigate to="/suppliers" replace />} />
          <Route path="/customer" element={<Navigate to="/customers" replace />} />
          <Route path="/return" element={<Navigate to="/returns" replace />} />
          <Route path="/return/new" element={<Navigate to="/returns/new" replace />} />
          <Route path="/product" element={<Navigate to="/products" replace />} />
          <Route path="/product/new" element={<Navigate to="/products/new" replace />} />
          <Route path="/product/edit/:id" element={<ProductEdit />} />
          <Route path="/purchase" element={<Navigate to="/purchases" replace />} />
          <Route path="/purchase/new" element={<Navigate to="/purchases/new" replace />} />
          <Route path="/purchase/edit/:id" element={<PurchaseEdit />} />
          <Route path="/sale-invoice" element={<Navigate to="/sales" replace />} />
          <Route path="/sale-invoice/new" element={<Navigate to="/sales/new" replace />} />
          <Route path="/sale-invoice/edit/:id" element={<SaleInvoiceEdit />} />
          <Route path="/sales-invoices" element={<Navigate to="/sales" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
