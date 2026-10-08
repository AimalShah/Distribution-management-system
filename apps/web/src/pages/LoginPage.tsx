import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Lock, LogIn, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { toFailure } from "../lib/api";
import { Button } from "@dms/ui";

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
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
      {/* Subtle background motif */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="inline-block h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/30 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <ShieldCheck className="text-primary" size={22} />
            <span className="font-semibold text-primary-foreground">DMS</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage inventory and sales</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="rounded-xl border bg-card p-6 shadow-sm">
          {/* Username */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground" htmlFor="login-username">
              Username <span className="text-destructive" aria-label="required">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="login-username"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {/* Password */}
          <div className="mb-2">
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground" htmlFor="login-password">
              Password <span className="text-destructive" aria-label="required">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="login-password"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type={revealPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={revealPassword ? "Hide password" : "Show password"}
                onClick={() => setRevealPassword((prev) => !prev)}
              >
                {revealPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 shrink-0 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="mt-6 w-full justify-center"
            disabled={submitting}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        {/*<div className="mt-6 rounded-lg bg-muted/40 p-4 text-center text-sm">
          <p className="mb-1 font-medium text-foreground">Default credentials</p>
          <p className="text-muted-foreground">
            Username: <strong>{useAuth.DESKTOP_USERNAME}</strong> · Password: <strong>{useAuth.DESKTOP_PASSWORD}</strong>
          </p>
        </div>*/}
      </div>
    </div>
  );
}
