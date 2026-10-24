import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@dms/ui";
import { authClient } from "../lib/auth-client";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const queryError = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [error, setError] = useState<string | null>(
    queryError ? "This password reset link is invalid or has expired." : null
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing reset token. Please request a new password reset link.");

      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");

      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    setSubmitting(true);

    try {
      const res = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (res?.error) {
        setError(res.error.message ?? "Could not reset password");
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Password reset failed. The link may have expired."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="inline-block h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted/30 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <ShieldCheck className="text-primary" size={22} />
            <span className="font-semibold text-primary">AM-Enterprise</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Set new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password for your account
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Password updated</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your password has been reset successfully. You can now sign in with your new credentials.
              </p>
              <Button asChild className="w-full mt-4">
                <Link to="/login">
                  Sign in with new password
                </Link>
              </Button>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Invalid Reset Link</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The reset link is missing a valid security token or has already expired.
              </p>
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/forgot-password">
                  Request a new link
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-medium text-muted-foreground"
                  htmlFor="new-password"
                >
                  New password <span className="text-destructive" aria-label="required">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="new-password"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type={revealPassword ? "text" : "password"}
                    autoComplete="new-password"
                    autoFocus
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
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

              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-medium text-muted-foreground"
                  htmlFor="confirm-password"
                >
                  Confirm password <span className="text-destructive" aria-label="required">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm-password"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type={revealPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 shrink-0 h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full justify-center"
                disabled={submitting || !newPassword || !confirmPassword}
              >
                {submitting ? "Updating password…" : "Update Password"}
              </Button>

              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
