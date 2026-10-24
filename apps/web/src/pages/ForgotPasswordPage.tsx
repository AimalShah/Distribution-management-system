import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@dms/ui";
import { authClient } from "../lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const res = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });

      if (res?.error) {
        setError(res.error.message ?? "Could not send reset password email");
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not send reset link. Try again later."
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to receive a password reset link
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Check your inbox</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an account exists for <strong className="text-foreground">{email}</strong>, we have sent a secure password reset link. Please check your spam folder if it doesn't arrive within a few minutes.
              </p>
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-medium text-muted-foreground"
                  htmlFor="reset-email"
                >
                  Email address <span className="text-destructive" aria-label="required">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="reset-email"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                disabled={submitting || !email.trim()}
              >
                {submitting ? "Sending reset link…" : "Send Reset Link"}
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
