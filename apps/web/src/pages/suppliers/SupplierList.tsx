import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { ResourceTable } from "../../components/common/ResourceTable";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { SearchInput } from "../../components/common/SearchInput";
import { usePaginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import type { Supplier } from "../../types/purchase";
import { SupplierDialog } from "./SupplierDialog";

export default function SupplierList() {
  const suppliers = usePaginated<Supplier>("/suppliers");
  const revalidate = useRevalidate();

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      { accessorKey: "supplierCode", header: "Code" },
      { accessorKey: "companyName", header: "Company" },
      { accessorKey: "contactPerson", header: "Contact" },
      { id: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
      { id: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
      { id: "city", header: "City", cell: ({ row }) => row.original.city ?? "—" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <SupplierDialog
              supplier={row.original}
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.companyName}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.companyName}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              title={`Delete ${row.original.companyName}?`}
              description="A supplier with purchases cannot be deleted; mark them inactive instead."
              onConfirm={async () => {
                try {
                  await api.delete(`/suppliers/${row.original.id}`);
                  toast.success("Supplier deleted");
                  await revalidate("/suppliers");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
          </div>
        ),
      },
    ],
    [revalidate]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Suppliers"
        description="The companies you buy stock from"
        actions={
          <SupplierDialog
            trigger={
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Add Supplier
              </Button>
            }
          />
        }
      />
      <SearchInput placeholder="Search suppliers" onSearch={suppliers.setSearch} />
      <ResourceTable columns={columns} result={suppliers} emptyMessage="No suppliers yet." />
    </div>
  );
}
