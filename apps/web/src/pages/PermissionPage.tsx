import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  ShieldCheck,
  Shield,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  RefreshCw,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dms/ui";
import {
  DEFAULT_ROLES,
  PERMISSION_STATEMENT,
  type PermissionResource,
  type PermissionItem,
} from "@dms/shared";
import { api, failureMessage, fetcher } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface RoleData {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { id?: string; resource: string; action: string }[];
  _count?: { members: number };
}

// Built-in fallback roles when loading or offline
const initialSystemRoles: RoleData[] = Object.values(DEFAULT_ROLES).map((role, idx) => ({
  id: `sys-${role.name.toLowerCase().replace(/\s+/g, "-")}`,
  name: role.name,
  description: role.description,
  isSystem: true,
  permissions: role.permissions.map((p) => ({ resource: p.resource, action: p.action })),
  _count: { members: idx === 0 ? 1 : 0 },
}));

// SAFETY: PermissionResource is `keyof typeof PERMISSION_STATEMENT`, and that
// literal defines exactly these keys, so Object.keys returns the members.
const RESOURCES = Object.keys(PERMISSION_STATEMENT) as PermissionResource[];

export default function PermissionPage() {
  const [activeTab, setActiveTab] = useState("matrix");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RoleData | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, mutate, isLoading } = useSWR("/roles", fetcher, {
    fallbackData: { roles: initialSystemRoles },
    revalidateOnFocus: false,
  });

  const roles: RoleData[] = useMemo(() => {
    if (data?.roles && Array.isArray(data.roles) && data.roles.length > 0) {
      return data.roles;
    }

    return initialSystemRoles;
  }, [data?.roles]);

  const systemRolesCount = useMemo(() => roles.filter((r) => r.isSystem).length, [roles]);
  const customRolesCount = useMemo(() => roles.filter((r) => !r.isSystem).length, [roles]);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setSelectedPermissions([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: RoleData) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    // SAFETY: every role this UI writes is assembled from PERMISSION_STATEMENT
    // keys (DEFAULT_ROLES and this page's matrix), so `resource` is one of them.
    setSelectedPermissions(
      role.permissions.map((p) => ({
        resource: p.resource as PermissionResource,
        action: p.action,
      }))
    );
    setDialogOpen(true);
  };

  const togglePermission = (resource: PermissionResource, action: string) => {
    setSelectedPermissions((prev) => {
      const exists = prev.some((p) => p.resource === resource && p.action === action);

      if (exists) {
        return prev.filter((p) => !(p.resource === resource && p.action === action));
      } else {
        return [...prev, { resource, action }];
      }
    });
  };

  const selectAll = () => {
    const all: PermissionItem[] = [];

    for (const [res, actions] of Object.entries(PERMISSION_STATEMENT)) {
      for (const act of actions) {
        // SAFETY: `res` is a key of PERMISSION_STATEMENT itself — the object
        // PermissionResource is defined from — so it is one of its members.
        all.push({ resource: res as PermissionResource, action: act });
      }
    }

    setSelectedPermissions(all);
  };

  const clearAll = () => {
    setSelectedPermissions([]);
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required");

      return;
    }

    setSaving(true);

    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: editingRole.isSystem ? editingRole.name : roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissions: selectedPermissions,
        });
        toast.success(`Role "${roleName}" updated successfully`);
      } else {
        await api.post("/roles", {
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissions: selectedPermissions,
        });
        toast.success(`Custom role "${roleName}" created successfully`);
      }

      setDialogOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to save role"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);

    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      toast.success(`Role "${deleteTarget.name}" deleted successfully`);
      setDeleteTarget(null);
      mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to delete role"));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl animate-slideInUp">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="hover:text-primary transition-colors cursor-pointer">
              Dashboard
            </span>
            <span>/</span>
            <span className="text-muted-foreground">Admin</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Permissions & Roles</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Permissions & Roles
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Granular role-based access control, system roles, and resource authorization matrices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="gap-2">
            <Plus className="size-4" />
            Create Custom Role
          </Button>
        </div>
      </div>

      {/* Role Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Roles</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{roles.length}</h3>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">System Roles</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">
                  {systemRolesCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Shield className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Custom Roles</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">
                  {customRolesCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrix">Role Matrix</TabsTrigger>
          <TabsTrigger value="roles">Role Management ({roles.length})</TabsTrigger>
        </TabsList>

        {/* Tab 1: Role Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">Role Matrix</CardTitle>
                    <Badge variant="secondary">RBAC</Badge>
                  </div>
                  <CardDescription className="mt-1">
                    Resource-level permission matrix comparing access across all defined roles.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px] font-semibold">Resource</TableHead>
                      <TableHead className="w-[200px]">Available Actions</TableHead>
                      {roles.map((role) => (
                        <TableHead key={role.id} className="text-center min-w-[120px]">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-foreground">
                              {role.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {role.isSystem ? "System" : "Custom"}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RESOURCES.map((resource) => {
                      const actions = PERMISSION_STATEMENT[resource];

                      return (
                        <TableRow key={resource}>
                          <TableCell className="font-medium capitalize">
                            {resource}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex flex-wrap gap-1">
                              {actions.map((act) => (
                                <span
                                  key={act}
                                  className="px-1.5 py-0.5 rounded bg-muted text-[11px]"
                                >
                                  {act}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          {roles.map((role) => {
                            const hasAll = actions.every((act) =>
                              role.permissions.some(
                                (p) =>
                                  (p.resource === resource || p.resource === "*") &&
                                  (p.action === act || p.action === "*")
                              )
                            );

                            const hasSome = actions.some((act) =>
                              role.permissions.some(
                                (p) =>
                                  (p.resource === resource || p.resource === "*") &&
                                  (p.action === act || p.action === "*")
                              )
                            );

                            return (
                              <TableCell key={role.id} className="text-center">
                                {hasAll ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs inline-flex items-center gap-1"
                                  >
                                    <Check className="size-3" /> Full
                                  </Badge>
                                ) : hasSome ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs inline-flex items-center gap-1"
                                  >
                                    Partial
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-muted text-muted-foreground text-xs inline-flex items-center gap-1"
                                  >
                                    <X className="size-3" /> None
                                  </Badge>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Note on Coming Soon policy extensions */}
              <div className="rounded-lg border border-dashed border-border p-4 mt-6 bg-muted/30 flex items-start gap-3">
                <Lock className="size-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-foreground">
                    Attribute-based access control (ABAC) and custom expression rules: Coming Soon
                  </p>
                  <p className="text-muted-foreground">
                    Checkpoint 06 RBAC engine enforces strict resource-action scopes across all API routes.
                    Custom dynamic conditions and field-level masking will extend this matrix in subsequent releases.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Role Management */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role Management</CardTitle>
              <CardDescription>
                System roles and user-defined roles with assigned members and permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Assigned Users</TableHead>
                      <TableHead className="text-center">Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-semibold text-foreground">
                          {role.name}
                        </TableCell>
                        <TableCell>
                          {role.isSystem ? (
                            <Badge variant="secondary">System Role</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-primary/10 text-primary border-primary/20"
                            >
                              Custom Role
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {role.description || "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {role._count?.members ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {role.permissions.length} actions
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(role)}
                              title="Edit permissions"
                              className="size-8 p-0"
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            {!role.isSystem ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(role)}
                                title="Delete role"
                                className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole
                ? editingRole.isSystem
                  ? `View System Role: ${editingRole.name}`
                  : `Edit Role: ${editingRole.name}`
                : "Create Custom Role"}
            </DialogTitle>
            <DialogDescription>
              {editingRole?.isSystem
                ? "System roles provide core operational security. Permissions cannot be removed."
                : "Configure role name and select granular resource actions allowed for this role."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Warehouse Supervisor"
                disabled={Boolean(editingRole?.isSystem)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="e.g. Can adjust stock and generate warehouse reports"
                disabled={Boolean(editingRole?.isSystem)}
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Resource Permissions</Label>
                {!editingRole?.isSystem && (
                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="h-7 text-xs"
                    >
                      Select All
                    </Button>
                    <span>|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAll}
                      className="h-7 text-xs"
                    >
                      Clear All
                    </Button>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg divide-y divide-border max-h-[360px] overflow-y-auto">
                {RESOURCES.map((resource) => {
                  const actions = PERMISSION_STATEMENT[resource];

                  return (
                    <div key={resource} className="p-3 space-y-1.5">
                      <div className="text-xs font-semibold capitalize text-foreground">
                        {resource}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => {
                          const isChecked = selectedPermissions.some(
                            (p) => p.resource === resource && p.action === action
                          );

                          return (
                            <button
                              key={action}
                              type="button"
                              onClick={() => {
                                if (!editingRole?.isSystem) {
                                  togglePermission(resource, action);
                                }
                              }}
                              disabled={Boolean(editingRole?.isSystem)}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-all flex items-center gap-1.5 ${
                                isChecked
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                              } ${editingRole?.isSystem ? "cursor-default opacity-85" : "cursor-pointer"}`}
                            >
                              <span className="capitalize">{action}</span>
                              {isChecked ? (
                                <Check className="size-3" />
                              ) : (
                                <span className="size-3 opacity-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {editingRole?.isSystem ? "Close" : "Cancel"}
            </Button>
            {!editingRole?.isSystem && (
              <Button type="button" onClick={handleSaveRole} disabled={saving}>
                {saving ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Custom Role"
        description={`Are you sure you want to delete the role "${deleteTarget?.name}"? Users assigned to this role must be reassigned.`}
        confirmLabel="Delete Role"
        destructive
        busy={deleteBusy}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
