import { useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../lib/api";
import { useActiveMembership } from "../lib/profile";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHead } from "../components/list/PageHead";
import {
  labelFor,
  MemberDialog,
  type AvailableUser,
  type MemberRow,
} from "../components/settings/MemberDialog";

/**
 * The Team page (issue #41).
 *
 * It used to call `/users`, which the server does not serve, and fall back to a
 * client-side list when no answer arrived -- so the page looked populated and
 * every action on it quietly did nothing. Membership is what this page shows,
 * and the membership API is what it now calls: members are listed for the
 * active Company, someone is added by choosing an account that already exists,
 * a role is changed on its own endpoint, and removal is by member id.
 */
export default function UsersPage() {
  const { membership, isLoading: membershipLoading } = useActiveMembership();
  const organizationId = membership?.organizationId ?? "";

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(
    organizationId ? `/organizations/${organizationId}/members` : null,
    fetcher
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  const { data: available } = useSWR(
    dialogOpen && !editing && organizationId
      ? `/organizations/${organizationId}/available-users`
      : null,
    (path: string) => api.get(path)
  );

  const members: MemberRow[] = Array.isArray(data) ? data : [];
  const availableUsers: AvailableUser[] = Array.isArray(available) ? available : [];

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (member: MemberRow) => {
    setEditing(member);
    setDialogOpen(true);
  };

  const submitDialog = async (input: { userId?: string; role: string }) => {
    if (editing) {
      await api.patch(`/members/${editing.id}/role`, { role: input.role });
      toast.success("Role updated");
    } else {
      await api.post(`/organizations/${organizationId}/members`, {
        userId: input.userId,
        role: input.role,
      });
      toast.success("Member added");
    }

    await mutate();
  };

  const confirmRemove = async () => {
    if (!removing) return;

    setRemovingBusy(true);

    try {
      await api.delete(`/members/${removing.id}`);
      toast.success("Member removed");
      setRemoving(null);
      await mutate();
    } catch (cause) {
      toast.error(failureMessage(cause, "Could not remove the member"));
    } finally {
      setRemovingBusy(false);
    }
  };

  const waitingForCompany = membershipLoading || !organizationId;

  return (
    <div>
      <PageHead
        title="Team & Permissions"
        subtitle="Who belongs to this Company, and what each of them may do"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add member
            </Button>
          </>
        }
      />

      <Card className="rounded-md border border-border shadow-none">
        <CardContent className="pt-6">
          {/* A refused request is not an empty team. Saying "no members" here
              would tell the user everyone had left when the truth is that the
              question never got answered (issue #41). */}
          {error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 py-10 text-center"
            >
              <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
              <p className="text-sm font-medium">Could not load the team</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {failureMessage(error, "The request failed. Try again.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : waitingForCompany || (isLoading && members.length === 0) ? (
            <div role="status" aria-label="Loading members" className="space-y-3">
              <span className="sr-only">Loading members</span>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="size-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No members yet</p>
              <p className="text-xs mt-0.5">
                Add an existing account to give it access to this Company.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-xs">Member</TableHead>
                    <TableHead className="font-semibold text-xs">Role</TableHead>
                    <TableHead className="font-semibold text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="text-xs">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {member.user.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {member.user.name}
                            </p>
                            <p className="text-muted-foreground">{member.user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Shield className="size-3" aria-hidden="true" />
                          {labelFor(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openEdit(member)}
                          >
                            <UserPlus className="size-3" aria-hidden="true" />
                            Change role
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs text-destructive"
                            onClick={() => setRemoving(member)}
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editing}
        availableUsers={availableUsers}
        onSubmit={submitDialog}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this member?"
        description={`${
          removing?.user.name ?? "This member"
        } loses access to this Company immediately.`}
        confirmLabel="Remove member"
        destructive
        busy={removingBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}