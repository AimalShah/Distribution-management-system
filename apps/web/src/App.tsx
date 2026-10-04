import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { FullPageSpinner } from "./components/layout/FullPageSpinner";
import { RequireAuth } from "./components/layout/RequireAuth";
import NotFound from "./pages/NotFound";

// Every page is its own chunk. The dashboard alone pulls in recharts, and the
// `size-limit` budget for the entry chunk is what a user downloads before the
// login screen paints -- see `.size-limit.json`.
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const RegisterCompany = lazy(() => import("./pages/auth/RegisterCompany"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductList = lazy(() => import("./pages/products/ProductList"));
const ProductForm = lazy(() => import("./pages/products/ProductForm"));
const PurchaseList = lazy(() => import("./pages/purchases/PurchaseList"));
const PurchaseForm = lazy(() => import("./pages/purchases/PurchaseForm"));
const PurchaseEdit = lazy(() => import("./pages/purchases/PurchaseEdit"));
const SaleInvoiceList = lazy(() => import("./pages/sales/SaleInvoiceList"));
const SaleInvoiceForm = lazy(() => import("./pages/sales/SaleInvoiceForm"));
const Inventory = lazy(() => import("./pages/inventory/Inventory"));
const ReturnList = lazy(() => import("./pages/returns/ReturnList"));
const ReturnForm = lazy(() => import("./pages/returns/ReturnForm"));

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/register" element={<RegisterCompany />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/product" element={<ProductList />} />
          <Route path="/product/new" element={<ProductForm />} />
          <Route path="/product/:id/edit" element={<ProductForm />} />
          <Route path="/purchase" element={<PurchaseList />} />
          <Route path="/purchase/new" element={<PurchaseForm />} />
          <Route path="/purchase/:id/edit" element={<PurchaseEdit />} />
          <Route path="/sale-invoice" element={<SaleInvoiceList />} />
          <Route path="/sale-invoice/new" element={<SaleInvoiceForm />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/returns" element={<ReturnList />} />
          <Route path="/returns/new" element={<ReturnForm />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
