import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@dms/ui";
import { useAuth } from "../../lib/auth";

/**
 * Wraps the app shell as a layout route, so every page underneath inherits the
 * session check instead of each one remembering to make it. An unauthenticated
 * visitor keeps where they were going: the login page hands that location back
 * and the router resumes it once the credentials check out.
 */
export function RequireAuth() {
  const { status, activeOrganizationId } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <Skeleton className="mb-4 h-10 w-3/4 mx-auto" />
          <p className="text-sm text-muted-foreground">Checking your session</p>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}`;

    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (
    status === "authenticated" &&
    activeOrganizationId === null &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
