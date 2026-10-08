import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

/**
 * Wraps the app shell as a layout route, so every page underneath inherits the
 * session check instead of each one remembering to make it. An unauthenticated
 * visitor keeps where they were going: the login page hands that location back
 * and the router resumes it once the credentials check out.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="auth-body">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-title">Signing you in…</div>
          <div className="auth-subtitle">Checking your session</div>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}`;

    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
