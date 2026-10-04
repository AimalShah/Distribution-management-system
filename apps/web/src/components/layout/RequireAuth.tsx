import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { FullPageSpinner } from "./FullPageSpinner";

/**
 * Client-side routing only; it is not what protects the data. Every API route
 * answers 401 without a session (checkpoint 3), so this exists to send a signed
 * out user to the login screen instead of a page of failed requests.
 *
 * A signed-in user with no active organization goes to `/register` to create
 * one: every tenant route answers 400 ORGANIZATION_REQUIRED until they do.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return <FullPageSpinner />;
  if (!data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!data.session.activeOrganizationId) return <Navigate to="/register" replace />;

  return <>{children}</>;
}
