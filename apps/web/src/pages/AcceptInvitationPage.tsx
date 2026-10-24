import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@dms/ui";
import { authClient } from "../lib/auth-client";
import { useAuth } from "../lib/auth";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  organizationName?: string;
}

export default function AcceptInvitationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { status } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("Invalid invitation link.");
      setLoading(false);

      return;
    }

    let isMounted = true;

    async function fetchInvitation() {
      try {
        const res = await authClient.organization.getInvitation({
          query: { id: id! },
        });

        if (!isMounted) return;

        if (res?.error) {
          setError(res.error.message ?? "Invitation not found or has expired");
        } else if (res?.data) {
          const rawData = res.data as Record<string, unknown>;
          const nestedOrg = rawData.organization as { name?: string } | undefined;
          const orgName = (typeof rawData.organizationName === "string" ? rawData.organizationName : undefined) ||
            nestedOrg?.name ||
            "the organization";

          setInvitation({
            id: res.data.id,
            email: res.data.email,
            role: res.data.role ?? "member",
            organizationName: orgName,
          });
        } else {
          setError("Invitation not found or has expired");
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to load invitation details"
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchInvitation();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const onAccept = async () => {
    if (!id) return;
    setAccepting(true);
    setError(null);

    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId: id,
      });

      if (res?.error) {
        setError(res.error.message ?? "Could not accept invitation");
      } else {
        setAccepted(true);
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1500);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Failed to accept invitation. Please try again."
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top_right,_var(--primary)/12%,_transparent_60%)]" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 p-3">
            <ShieldCheck className="text-primary" size={22} />
            <span className="font-semibold text-primary">AM-Enterprise</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Team Invitation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join your team on AM-Enterprise
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading invitation details…</p>
            </div>
          ) : accepted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Invitation Accepted!</h2>
              <p className="text-xs text-muted-foreground">
                You are now a member of {invitation?.organizationName}. Redirecting to dashboard…
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Invitation Problem</h2>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button asChild variant="outline" className="w-full mt-4">
                <Link to="/login">Go to Sign In</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-4 text-center space-y-2">
                <Building2 className="mx-auto h-8 w-8 text-primary/70" />
                <h3 className="text-sm font-semibold text-foreground">
                  {invitation?.organizationName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Invited as <span className="font-medium text-foreground">{invitation?.role}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Target email: <strong>{invitation?.email}</strong>
                </p>
              </div>

              {status !== "authenticated" ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-center text-muted-foreground">
                    Please sign in with <strong className="text-foreground">{invitation?.email}</strong> to accept this invitation.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/login">Sign in to accept</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <Button
                    onClick={() => void onAccept()}
                    disabled={accepting}
                    className="w-full justify-center"
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {accepting ? "Joining team…" : "Accept Invitation"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
