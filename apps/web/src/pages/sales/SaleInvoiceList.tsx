import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { FileDown, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { ResourceTable } from "../../components/common/ResourceTable";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { SearchInput } from "../../components/common/SearchInput";
import { usePaginated } from "../../hooks/use-paginated";
import { useRevalidate } from "../../hooks/use-revalidate";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/fetcher";
import { formatCurrency, formatDate } from "../../lib/format";
import { downloadInvoicePdf, openInvoicePrintView } from "../../lib/invoice";
import { StatusBadge } from "../../components/common/StatusBadge";
import type { SaleListRow } from "../../types/sale";

const run = (action: () => Promise<unknown>) => () => {
  action().catch((error) => toast.error(errorMessage(error)));
};

export default function SaleInvoiceList() {
  const sales = usePaginated<SaleListRow>("/sales");
  const revalidate = useRevalidate();

  const columns = useMemo<ColumnDef<SaleListRow>[]>(
    () => [
      { accessorKey: "saleCode", header: "Code" },
      { id: "customer", header: "Customer", cell: ({ row }) => row.original.customer.name },
      { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.saleDate) },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: "items", header: "Items", cell: ({ row }) => row.original._count.items },
      { id: "total", header: "Total", cell: ({ row }) => formatCurrency(row.original.totalAmount) },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const sale = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Print ${sale.saleCode}`}
                onClick={run(() => openInvoicePrintView(sale.id))}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Download PDF ${sale.saleCode}`}
                onClick={run(() => downloadInvoicePdf(sale.id, sale.saleCode))}
              >
                <FileDown className="h-4 w-4" />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Delete ${sale.saleCode}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
                title={`Delete ${sale.saleCode}?`}
                description="The stock this invoice took is put back into inventory. An invoice with returns recorded against it cannot be deleted."
                onConfirm={async () => {
                  try {
                    await api.delete(`/sales/${sale.id}`);
                    toast.success("Invoice deleted");
                    await revalidate("/sales", "/inventory", "/dashboard/stats");
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                }}
              />
            </div>
          );
        },
      },
    ],
    [revalidate]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Sale Invoices"
        description="Invoices issued to customers"
        actions={
          <Button asChild>
            <Link to="/sale-invoice/new">
              <Plus className="mr-1 h-4 w-4" /> New Invoice
            </Link>
          </Button>
        }
      />
      <SearchInput placeholder="Search by invoice code" onSearch={sales.setSearch} />
      <ResourceTable columns={columns} result={sales} emptyMessage="No invoices yet." />
    </div>
  );
}
