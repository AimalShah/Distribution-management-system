import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/auth/RequireAuth";
import { Skeleton } from "@dms/ui";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductList = lazy(() => import("./pages/ProductList"));
const ProductNew = lazy(() => import("./pages/ProductNew"));
const ProductEdit = lazy(() => import("./pages/ProductEdit"));
const PurchaseList = lazy(() => import("./pages/PurchaseList"));
const PurchaseNew = lazy(() => import("./pages/PurchaseNew"));
const PurchaseEdit = lazy(() => import("./pages/PurchaseEdit"));
const SaleInvoiceList = lazy(() => import("./pages/SaleInvoiceList"));
const SaleInvoiceNew = lazy(() => import("./pages/SaleInvoiceNew"));
const SaleInvoiceEdit = lazy(() => import("./pages/SaleInvoiceEdit"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReturnList = lazy(() => import("./pages/ReturnList"));
const ReturnNew = lazy(() => import("./pages/ReturnNew"));
const CustomerList = lazy(() => import("./pages/CustomerList"));
const CustomerLedgerPage = lazy(() => import("./pages/CustomerLedgerPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const SupplierList = lazy(() => import("./pages/SupplierList"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const PermissionPage = lazy(() => import("./pages/PermissionPage"));
const CompanySettingsPage = lazy(() => import("./pages/CompanySettingsPage"));
const BatchesPage = lazy(() => import("./pages/BatchesPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageFallback() {
  return <Skeleton className="h-[60vh]" />;
}

export function App() {
  return (
    <Routes>
      {/* Outside the guard on purpose: it is the one page reachable signed out. */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        }
      />

      <Route element={<RequireAuth />}>
        {/* Onboarding is shown to authenticated users who have no active organization */}
        <Route
          path="/onboarding"
          element={
            <Suspense fallback={<PageFallback />}>
              <OnboardingPage />
            </Suspense>
          }
        />

        <Route element={<AppShell />}>
          <Route
            path="/"
            element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>}
          />
          <Route
            path="/inventory"
            element={<Suspense fallback={<PageFallback />}><InventoryPage /></Suspense>}
          />
          {/* The sidebar's "Batches" entry points here, so the route has to
              exist as a page of its own rather than only as a tab inside
              InventoryPage (issue #40). */}
          <Route
            path="/inventory/batches"
            element={<Suspense fallback={<PageFallback />}><BatchesPage /></Suspense>}
          />
          <Route
            path="/products"
            element={<Suspense fallback={<PageFallback />}><ProductList /></Suspense>}
          />
          <Route
            path="/products/new"
            element={<Suspense fallback={<PageFallback />}><ProductNew /></Suspense>}
          />
          <Route
            path="/products/:id/edit"
            element={<Suspense fallback={<PageFallback />}><ProductEdit /></Suspense>}
          />

          {/* Customer routes */}
          <Route
            path="/customers"
            element={<Suspense fallback={<PageFallback />}><CustomerList /></Suspense>}
          />
          <Route
            path="/customers/:id/ledger"
            element={<Suspense fallback={<PageFallback />}><CustomerLedgerPage /></Suspense>}
          />

          {/* Payment routes */}
          <Route
            path="/payments"
            element={<Suspense fallback={<PageFallback />}><PaymentsPage /></Suspense>}
          />

          {/* Supplier routes */}
          <Route
            path="/suppliers"
            element={<Suspense fallback={<PageFallback />}><SupplierList /></Suspense>}
          />

          {/* Purchase routes */}
          <Route
            path="/purchases"
            element={<Suspense fallback={<PageFallback />}><PurchaseList /></Suspense>}
          />
          <Route
            path="/purchases/new"
            element={<Suspense fallback={<PageFallback />}><PurchaseNew /></Suspense>}
          />
          <Route
            path="/purchases/:id/edit"
            element={<Suspense fallback={<PageFallback />}><PurchaseEdit /></Suspense>}
          />

          {/* Sale Invoice routes */}
          <Route
            path="/sales"
            element={<Suspense fallback={<PageFallback />}><SaleInvoiceList /></Suspense>}
          />
          <Route
            path="/sales/new"
            element={<Suspense fallback={<PageFallback />}><SaleInvoiceNew /></Suspense>}
          />
          <Route
            path="/sales/:id/edit"
            element={<Suspense fallback={<PageFallback />}><SaleInvoiceEdit /></Suspense>}
          />

          {/* Return routes */}
          <Route
            path="/returns"
            element={<Suspense fallback={<PageFallback />}><ReturnList /></Suspense>}
          />
          <Route
            path="/returns/new"
            element={<Suspense fallback={<PageFallback />}><ReturnNew /></Suspense>}
          />

          {/* Report routes */}
          <Route
            path="/reports"
            element={<Suspense fallback={<PageFallback />}><ReportsPage /></Suspense>}
          />

          {/* Settings & Admin routes */}
          <Route
            path="/profile"
            element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>}
          />
          <Route
            path="/settings/profile"
            element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>}
          />
          <Route
            path="/users"
            element={<Suspense fallback={<PageFallback />}><UsersPage /></Suspense>}
          />
          <Route
            path="/settings/users"
            element={<Suspense fallback={<PageFallback />}><UsersPage /></Suspense>}
          />
          <Route
            path="/billing"
            element={<Suspense fallback={<PageFallback />}><BillingPage /></Suspense>}
          />
          <Route
            path="/settings/billing"
            element={<Suspense fallback={<PageFallback />}><BillingPage /></Suspense>}
          />
          <Route
            path="/permissions"
            element={<Suspense fallback={<PageFallback />}><PermissionPage /></Suspense>}
          />
          <Route
            path="/permission"
            element={<Suspense fallback={<PageFallback />}><PermissionPage /></Suspense>}
          />
          <Route
            path="/settings/permissions"
            element={<Suspense fallback={<PageFallback />}><PermissionPage /></Suspense>}
          />
          <Route
            path="/settings/permission"
            element={<Suspense fallback={<PageFallback />}><PermissionPage /></Suspense>}
          />
          <Route
            path="/settings/company"
            element={<Suspense fallback={<PageFallback />}><CompanySettingsPage /></Suspense>}
          />

          {/* Legacy route compatibility */}
          <Route path="/user" element={<Navigate to="/users" replace />} />
          <Route path="/report" element={<Navigate to="/reports" replace />} />
          <Route path="/supplier" element={<Navigate to="/suppliers" replace />} />
          <Route path="/customer" element={<Navigate to="/customers" replace />} />
          <Route path="/return" element={<Navigate to="/returns" replace />} />
          <Route path="/return/new" element={<Navigate to="/returns/new" replace />} />
          <Route path="/product" element={<Navigate to="/products" replace />} />
          <Route path="/product/new" element={<Navigate to="/products/new" replace />} />
          <Route
            path="/product/edit/:id"
            element={<Suspense fallback={<PageFallback />}><ProductEdit /></Suspense>}
          />
          <Route path="/purchase" element={<Navigate to="/purchases" replace />} />
          <Route path="/purchase/new" element={<Navigate to="/purchases/new" replace />} />
          <Route
            path="/purchase/edit/:id"
            element={<Suspense fallback={<PageFallback />}><PurchaseEdit /></Suspense>}
          />
          <Route path="/sale-invoice" element={<Navigate to="/sales" replace />} />
          <Route path="/sale-invoice/new" element={<Navigate to="/sales/new" replace />} />
          <Route
            path="/sale-invoice/edit/:id"
            element={<Suspense fallback={<PageFallback />}><SaleInvoiceEdit /></Suspense>}
          />
          <Route path="/sales-invoices" element={<Navigate to="/sales" replace />} />

          {/* The catch-all has to be the last route in this shell. It turns
              every unmatched address into a real page instead of an empty
              `<Outlet>` — a blank white screen the user cannot diagnose
              (issue #40). */}
          <Route
            path="*"
            element={<Suspense fallback={<PageFallback />}><NotFoundPage /></Suspense>}
          />
        </Route>
      </Route>
    </Routes>
  );
}
