import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { toFailure } from "../lib/api";

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // SAFETY: router state here comes only from our own guard navigation, which
  // passes `{ from }` or nothing at all; `?.from` tolerates the rest.
  const from = (location.state as LocationState | null)?.from || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in -- back to wherever the guard intercepted this visit.
  if (status === "authenticated") {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const failure = toFailure(err, "Sign in failed");

      setError(failure.origin === "network" ? "Cannot reach the server" : failure.message);

      setSubmitting(false);
    }
  };

  return (
    <div className="auth-body">
      <div className="auth-bg-shape auth-bg-shape-1" />
      <div className="auth-bg-shape auth-bg-shape-2" />
      <div className="auth-bg-shape auth-bg-shape-3" />

      <div className="auth-card" style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            className="auth-logo-wrap"
            style={{ margin: "0 auto 16px", display: "inline-flex" }}
          >
            <ShieldCheck size={22} color="var(--primary-strong)" />
            <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
              DMS
            </span>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to manage inventory and sales</p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="login-username">
              Username <span className="required">*</span>
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                id="login-username"
                className="form-input"
                style={{ paddingLeft: "36px" }}
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="Enter your username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "8px" }}>
            <label className="form-label" htmlFor="login-password">
              Password <span className="required">*</span>
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                id="login-password"
                className="form-input"
                style={{ paddingLeft: "36px", paddingRight: "38px" }}
                type={revealPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setRevealPassword((prev) => !prev)}
                aria-label={revealPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                {revealPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                color: "var(--danger)",
                fontSize: "13px",
                margin: "8px 0 0",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "20px", justifyContent: "center" }}
            disabled={submitting}
          >
            <LogIn size={16} />
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/*<div className="auth-demo-box">
          <div className="auth-demo-box-title">Default credentials</div>
          <div className="auth-demo-box-text">
            Username: <strong>{DEFAULT_CREDENTIALS.username}</strong> · Password:{" "}
            <strong>{DEFAULT_CREDENTIALS.password}</strong>
          </div>
        </div>*/}
      </div>
    </div>
  );
}
