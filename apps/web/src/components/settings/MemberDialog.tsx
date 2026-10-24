import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dms/ui";
import { api } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { invalidateDomains } from "../../lib/mutation";

/**
 * Adding or re-roling a member (issue #41), plus creating the staff account
 * itself (P0-5).
 *
 * The original replacement removed a form that collected a name, an email, a
 * password and an "active" checkbox and posted them to `/users` -- an endpoint
 * the server did not serve, so every save silently did nothing. Membership is
 * a different shape: someone is added by choosing an account that already
 * exists and giving it a role, and a member's role is changed on its own.
 *
 * What is back under P0-5 is the account creation itself -- on a correct
 * endpoint this time: there was no way to create the first staff account at
 * all ("add member" only offered accounts that already exist, which a fresh
 * tenant has none of). `StaffDialog` posts to `/organizations/:id/staff`,
 * which mints the credential, and shows the temporary password once.
 */

/** The roles `memberRoleSchema` accepts. `adminRole` is the server's spelling. */
export const MEMBER_ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "adminRole", label: "Administrator" },
  { value: "owner", label: "Owner" },
] as const;

export interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

/** A member as `listMembers` returns it. */
export interface MemberRow {
  id: string;
  role: string;
  createdAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    /** P0-5: the locked-out state the row renders (and the action it offers). */
    banned?: boolean | null;
    mustChangePassword?: boolean | null;
  };
}

const labelFor = (role: string) =>
  MEMBER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when changing someone's role; unset when adding someone. */
  member: MemberRow | null;
  /** Accounts not yet in the Company. Only fetched when adding. */
  availableUsers: AvailableUser[];
  onSubmit: (input: { userId?: string; role: string }) => Promise<void>;
}

/** Adding and re-roling differ only in what they ask for and where they post. */
export function MemberDialog({
  open,
  onOpenChange,
  member,
  availableUsers,
  onSubmit,
}: MemberDialogProps) {
  const isEditing = Boolean(member);

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setUserId("");
    setRole(member?.role ?? "member");
    setError(null);
  }, [open, member]);

  const submit = async () => {
    if (!isEditing && !userId) {
      setError("Choose someone to add");

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({ userId: userId || undefined, role });
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message ? cause.message : "Could not save"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Change role" : "Add a team member"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update what ${member?.user.name} may do in this Company.`
              : "Give an existing account access to this Company."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEditing ? (
            <div className="space-y-2">
              <Label htmlFor="member-user">Account</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="member-user" aria-label="User">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Everyone already belongs
                    </SelectItem>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="member-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="member-role" aria-label="Role">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
            {isEditing ? "Save" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { labelFor };

/**
 * The temporary password is generated client-side so nobody has to invent one:
 * the owner reads it once to hand it over, and it comes from the browser's
 * CSPRNG rather than a phrasable pattern.
 */
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateTempPassword = () => {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => TEMP_ALPHABET[byte % TEMP_ALPHABET.length]).join("");
};

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

/**
 * P0-5: create the staff account itself.
 *
 * The account opens with a temporary password and `mustChangePassword` on the
 * server: staff enters the app, is immediately routed to the password screen,
 * and cannot reach tenant data until the password has actually been replaced
 * with one only they hold.
 */
export function StaffDialog({ open, onOpenChange, organizationId }: StaffDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRole("member");
      setTempPassword(generateTempPassword());
      setCreated(null);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await api.post<{ id: string; name: string; email: string }>(
        `/organizations/${organizationId}/staff`,
        { name: name.trim(), email: email.trim(), tempPassword, role }
      );

      setCreated(response);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not create the account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {created ? null : (
          <DialogHeader>
            <DialogTitle>Create a staff account</DialogTitle>
            <DialogDescription>
              The account is created immediately, with a temporary password it must
              replace at first login.
            </DialogDescription>
          </DialogHeader>
        )}

        {created ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>
                Hand the temporary password to {created.name} now — it is shown this once.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/40 p-3 text-center">
              <p
                id="staff-temp-password"
                className="font-mono text-base font-medium tracking-wide select-all"
              >
                {tempPassword}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(tempPassword)
                    .then(() => toast.success("Password copied"))
                    .catch(() => toast.error("Copy failed — select the password by hand"));
                }}
              >
                Copy password
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  placeholder="Ayesha Khan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="off"
                  placeholder="ayesha@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="staff-role" aria-label="Role">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-temp-password">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="staff-temp-password"
                    value={tempPassword}
                    onChange={(event) => setTempPassword(event.target.value)}
                    className="font-mono"
                    spellCheck={false}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setTempPassword(generateTempPassword())}
                    aria-label="Regenerate temporary password"
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They change this themselves on first login; the server forces the
                  change.
                </p>
              </div>
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={submitting}>
                Create account
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("member");
    setError(null);
    setSubmitting(false);
  }, [open]);

  const submit = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await authClient.organization.inviteMember({
        email: email.trim(),
        role: role as "member" | "admin" | "owner",
        organizationId,
      });

      if (res?.error) {
        setError(res.error.message ?? "Could not send invitation");
      } else {
        toast.success(`Invitation sent to ${email.trim()}`);
        invalidateDomains("members");
        onOpenChange(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not send invitation"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            Send an email invitation to join this Company. They will receive a link to accept and set up their access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role" aria-label="Role">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="adminRole">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !email.trim()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending invite…
              </>
            ) : (
              "Send Invitation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
