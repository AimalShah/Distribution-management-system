import React, { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ChevronDown, Building2, AlertTriangle, Plus, Settings2 } from "lucide-react";
import { api } from "../../lib/api";
import { useActiveMembership } from "../../lib/profile";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@dms/ui";
import { CreateCompanyDialog } from "../settings/CreateCompanyDialog";
import { EditCompanyDialog } from "../settings/EditCompanyDialog";

/**
 * The Company switcher in the topbar (issue #42).
 *
 * Shows the active Company and lets the user switch to another one or create a new one.
 * Calls GET /api/organizations to list the user's companies, and
 * POST /api/organizations/set-active to switch the active organization.
 */
export function CompanySwitcher() {
  const { membership } = useActiveMembership();
  const organizationId = membership?.organizationId ?? "";
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const { data, error, isLoading, mutate } = useSWR(
    organizationId ? "/organizations" : null,
    (path: string) => api.get(path)
  );

  const organizations = Array.isArray(data) ? data : [];
  const activeOrg = organizations.find((o) => o.id === organizationId);

  const switchOrganization = async (targetOrgId: string) => {
    try {
      await api.post("/organizations/set-active", { organizationId: targetOrgId });
      await mutate();
      await globalMutate(() => true, undefined, { revalidate: true });
    } catch (err) {
      console.error("Failed to switch organization:", err);
    }
  };

  if (isLoading && organizations.length === 0) {
    return (
      <div role="status" aria-label="Loading companies" className="flex items-center gap-1.5 h-8 px-3">
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-3"
          >
            <Building2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline font-medium">
              {activeOrg?.name ?? "Select Company"}
            </span>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 min-w-[14rem] py-2" sideOffset={4}>
          {error ? (
            <div role="alert" className="flex items-center gap-2 px-2 py-2 text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <span className="text-sm">Could not load companies</span>
            </div>
          ) : (
            <React.Fragment>
              {organizations.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  className="flex items-center gap-2"
                  onSelect={() => switchOrganization(organization.id)}
                  disabled={organization.id === organizationId}
                >
                  {organization.id === organizationId && (
                    <span className="size-4 flex-shrink-0">✓</span>
                  )}
                  <span className="flex-1 text-left">{organization.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {activeOrg && (
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer font-medium"
                  onSelect={() => setEditDialogOpen(true)}
                >
                  <Settings2 className="size-4" />
                  <span>Edit Company Details</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="flex items-center gap-2 text-primary focus:text-primary cursor-pointer font-medium"
                onSelect={() => setCreateDialogOpen(true)}
              >
                <Plus className="size-4" />
                <span>Create Company</span>
              </DropdownMenuItem>
            </React.Fragment>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCompanyDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        organization={
          activeOrg
            ? { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug }
            : null
        }
        onSuccess={async () => {
          await mutate();
          await globalMutate(() => true, undefined, { revalidate: true });
        }}
      />

      <CreateCompanyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={async () => {
          await mutate();
          await globalMutate(() => true, undefined, { revalidate: true });
        }}
      />
    </div>
  );
}

export default CompanySwitcher;
