import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
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
import { formatDate } from "../../lib/format";
import { RETURN_TYPES, type ReturnListRow } from "../../types/returns";

const typeLabel = (type: string) => RETURN_TYPES.find((t) => t.value === type)?.label ?? type;

export default function ReturnList() {
  const returns = usePaginated<ReturnListRow>("/returns");
  const revalidate = useRevalidate();

  const columns = useMemo<ColumnDef<ReturnListRow>[]>(
    () => [
      { accessorKey: "returnCode", header: "Code" },
      { id: "type", header: "Type", cell: ({ row }) => <Badge variant="outline">{typeLabel(row.original.returnType)}</Badge> },
      { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.returnDate) },
      { id: "reason", header: "Reason", cell: ({ row }) => row.original.reason ?? "—" },
      { id: "items", header: "Items", cell: ({ row }) => row.original._count.items },
      { id: "by", header: "Recorded by", cell: ({ row }) => row.original.user.name },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.returnCode}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              title={`Delete ${row.original.returnCode}?`}
              description="The stock movement this return made is reversed."
              onConfirm={async () => {
                try {
                  await api.delete(`/returns/${row.original.id}`);
                  toast.success("Return deleted");
                  await revalidate("/returns", "/inventory", "/dashboard/stats");
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
        title="Returns"
        description="Customer returns, returns to suppliers and write-offs"
        actions={
          <Button asChild>
            <Link to="/returns/new">
              <Plus className="mr-1 h-4 w-4" /> New Return
            </Link>
          </Button>
        }
      />
      <SearchInput placeholder="Search by return code" onSearch={returns.setSearch} />
      <ResourceTable columns={columns} result={returns} emptyMessage="No returns yet." />
    </div>
  );
}
