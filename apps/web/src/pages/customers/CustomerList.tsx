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
import { formatCurrency } from "../../lib/format";
import type { Customer } from "../../types/sale";
import { CustomerDialog } from "./CustomerDialog";

export default function CustomerList() {
  const customers = usePaginated<Customer>("/customers");
  const revalidate = useRevalidate();

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      { accessorKey: "customerCode", header: "Code" },
      { accessorKey: "name", header: "Name" },
      { id: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
      { id: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
      { id: "city", header: "City", cell: ({ row }) => row.original.city ?? "—" },
      {
        id: "creditLimit",
        header: "Credit limit",
        cell: ({ row }) => (row.original.creditLimit === null ? "—" : formatCurrency(row.original.creditLimit)),
      },
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
            <CustomerDialog
              customer={row.original}
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              title={`Delete ${row.original.name}?`}
              description="A customer with invoices cannot be deleted; mark them inactive instead."
              onConfirm={async () => {
                try {
                  await api.delete(`/customers/${row.original.id}`);
                  toast.success("Customer deleted");
                  await revalidate("/customers", "/dashboard/stats");
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
        title="Customers"
        description="The people and businesses you sell to"
        actions={
          <CustomerDialog
            trigger={
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Add Customer
              </Button>
            }
          />
        }
      />
      <SearchInput placeholder="Search customers" onSearch={customers.setSearch} />
      <ResourceTable columns={columns} result={customers} emptyMessage="No customers yet." />
    </div>
  );
}
