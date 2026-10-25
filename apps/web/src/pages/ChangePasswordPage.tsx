import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@dms/ui";
import { api, failureMessage } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { useAuth } from "../lib/auth";

/**
 * P0-5: the forced first-login password change.
 *
 * A staff member the owner provisioned arrives with a temporary password. The
 * server refuses every tenant request with PASSWORD_CHANGE_REQUIRED until that
 * password has been replaced -- this is where the replacement happens. The
 * answer clears `mustChangePassword` on the server, so after the POST lands
 * the next request anywhere succeeds.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const { user, status, refetchSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && !user?.mustChangePassword) {
      navigate("/", { replace: true });
    }
  }, [status, user?.mustChangePassword, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword !== confirm) {
      setError("The passwords do not match");

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.post("/users/me/password", { currentPassword, newPassword });

      toast.success("Password set. You are all set.");

      // Re-read the session so the cleared flag reaches the guard immediately;
      // `refetch`s update the same session store the provider subscribes to.
      try {
        await session.refetch();
      } catch {}

      try {
        if (refetchSession) {
          await refetchSession();
        }
      } catch {}

      navigate("/", { replace: true });
    } catch (cause) {
      setError(failureMessage(cause, "Could not set the password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
      <Card className="w-full max-w-sm rounded-md border border-border shadow-none">
        <CardContent className="pt-6 space-y-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="size-5 text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold">Set your password</h1>
            <p className="text-sm text-muted-foreground">
              Your account starts with a temporary password. Choose a new one —
              you cannot use the app until you have.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Temporary password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
                  aria-label={showCurrent ? "Hide temporary password" : "Show temporary password"}
                  onClick={() => setShowCurrent((prev) => !prev)}
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="pr-10"
                  required
                  aria-describedby="new-password-hint"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
                  aria-label={showNew ? "Hide new password" : "Show new password"}
                  onClick={() => setShowNew((prev) => !prev)}
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p id="new-password-hint" className="text-xs text-muted-foreground">
                At least 8 characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Save password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
