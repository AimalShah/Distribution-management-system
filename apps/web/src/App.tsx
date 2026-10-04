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
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
