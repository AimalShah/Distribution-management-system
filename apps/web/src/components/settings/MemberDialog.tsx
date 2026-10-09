import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dms/ui";

/**
 * Adding or re-roling a member (issue #41).
 *
 * This replaces a form that collected a name, an email, a password and an
 * "active" checkbox and posted them to `/users` -- an endpoint the server does
 * not serve, so every save silently did nothing. Membership is a different
 * shape of operation: someone is added by choosing an account that already
 * exists and giving it a role, and a member's role is changed on its own.
 *
 * There is deliberately no password field. `User` has no password column and
 * better-auth keeps the hash in `Account`, so only better-auth can mint a
 * credential; an admin cannot invent one here.
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
  user: { id: string; name: string; email: string; image?: string | null };
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