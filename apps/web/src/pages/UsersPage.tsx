import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Filter, Plus, RefreshCw, Search, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { UserDialog, type UserRow } from "../components/settings/UserDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";

// The API is the source of truth; this is only what the table shows before the
// first response lands, and it starts blank so a fresh install invents nobody.
const defaultUsers: UserRow[] = [];

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search.trim()) params.set("search", search.trim());

    if (roleFilter !== "all") params.set("role", roleFilter);

    return params.toString();
  }, [page, pageSize, search, roleFilter]);

  const { data, isLoading, mutate } = useSWR(
    `/users?${queryString}`,
    fetcher,
    {
      fallbackData: {
        data: defaultUsers,
        total: defaultUsers.length,
        pageCount: 1,
      },
    }
  );

  const rawUsers: UserRow[] = useMemo(() => {
    if (data?.data && Array.isArray(data.data)) {
      return data.data;
    }

    return defaultUsers;
  }, [data?.data]);

  // In-memory filter fallback when API returns unfiltered items
  const filteredUsers = useMemo(() => {
    return rawUsers.filter((u) => {
      const matchesSearch =
        !search.trim() ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [rawUsers, search, roleFilter]);

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: UserRow) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);

    try {
      await api.delete(`/users/${confirmTarget.id}`);
      toast.success("User removed successfully");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to remove user"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<UserRow, any>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => {
          const u = row.original;

          const initials = u.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2);

          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => {
          const isElevated =
            row.original.role === "adminRole" ||
            row.original.role === "admin" ||
            row.original.role === "owner";

          return (
            <Badge
              variant={isElevated ? "default" : "secondary"}
              className={`flex items-center gap-1 w-fit text-xs ${isElevated ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {isElevated && <Shield className="size-3" />}
              <span>{isElevated ? "Admin" : "Employee"}</span>
            </Badge>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const u = row.original;

          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                onClick={() => handleOpenEdit(u)}
              >
                <span className="sr-only">Edit</span>
                <Edit className="size-3.5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                onClick={() => setConfirmTarget({ id: u.id, label: u.name })}
              >
                <span className="sr-only">Delete</span>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Operational Breadcrumb & Action Header */}
      <ListPageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors cursor-pointer">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-muted-foreground">Contacts & Business</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Team &amp; Permissions</span>
          </>
        }
        title="Team &amp; Permissions"
        subtitle="Manage organization members, assign operational roles, and access credentials"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isLoading}
              className="btn-secondary h-9 rounded-md cursor-pointer"
            >
              <RefreshCw className="size-3.5 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
              <Plus className="size-4 mr-2" />
              Add User
            </Button>
          </>
        }
      />

      {/* Filter and Table Card */}
      <div className="card p-0 overflow-hidden">
        {/* Invenza Filter Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs rounded-lg bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-1">
              <Filter className="size-3.5" />
              <span>Role:</span>
            </div>
            <Select
              value={roleFilter}
              onValueChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg bg-background">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="adminRole">Admin</SelectItem>
                <SelectItem value="member">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Invenza Table Container */}
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : filteredUsers.length > 0 ? (
            <DataTable
              columns={columns}
              data={filteredUsers}
              pageCount={data?.pageCount ?? 1}
              pageIndex={page - 1}
              pageSize={pageSize}
              onPaginationChange={(nextPage) => setPage(nextPage + 1)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                <Users className="size-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No users found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {search || roleFilter !== "all"
                  ? "Try adjusting your search query or role filter."
                  : "Invite or provision team members to access this distribution system."}
              </p>
              {!search && roleFilter === "all" && (
                <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md">
                  <Plus className="size-4 mr-2" />
                  Add User
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Dialog (Add / Edit) */}
      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        onSuccess={() => mutate()}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Delete user "${confirmTarget?.label ?? ""}"?`}
        description="The member loses access immediately. Their activity on invoices and payments stays on record."
        confirmLabel="Remove user"
        destructive
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
