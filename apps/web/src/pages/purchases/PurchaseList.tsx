import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { formatCurrency, formatDate } from "../../lib/format";
import type { PurchaseListRow } from "../../types/purchase";

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Completed" ? "default" : status === "Cancelled" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function PurchaseList() {
  const purchases = usePaginated<PurchaseListRow>("/purchases");
  const revalidate = useRevalidate();
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<PurchaseListRow>[]>(
    () => [
      { accessorKey: "purchaseCode", header: "Code" },
      { id: "supplier", header: "Supplier", cell: ({ row }) => row.original.supplier.companyName },
      { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.purchaseDate) },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: "items", header: "Items", cell: ({ row }) => row.original._count.purchaseItems },
      { id: "total", header: "Total", cell: ({ row }) => formatCurrency(row.original.totalAmount) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${row.original.purchaseCode}`}
              onClick={() => navigate(`/purchase/${row.original.id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.purchaseCode}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              title={`Delete ${row.original.purchaseCode}?`}
              description="The stock this purchase added is taken back out of inventory. If any of it has already been sold, the purchase cannot be deleted."
              onConfirm={async () => {
                try {
                  await api.delete(`/purchases/${row.original.id}`);
                  toast.success("Purchase deleted");
                  await revalidate("/purchases", "/inventory", "/dashboard/stats");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
          </div>
        ),
      },
    ],
    [navigate, revalidate]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Purchases"
        description="Stock received from suppliers"
        actions={
          <Button asChild>
            <Link to="/purchase/new">
              <Plus className="mr-1 h-4 w-4" /> New Purchase
            </Link>
          </Button>
        }
      />
      <SearchInput placeholder="Search by purchase code" onSearch={purchases.setSearch} />
      <ResourceTable columns={columns} result={purchases} emptyMessage="No purchases yet." />
    </div>
  );
}
