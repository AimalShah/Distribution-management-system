import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Filter,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@dms/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";
import { ListTablePanel } from "../components/list/ListTablePanel";

export interface ReturnRow {
  id: string;
  returnCode: string;
  returnType: "SALE" | "PURCHASE" | "EXPIRED" | "DAMAGED";
  returnDate: string;
  reason?: string | null;
  saleId?: string | null;
  purchaseId?: string | null;
  sale?: { id: string; saleCode: string } | null;
  purchase?: { id: string; purchaseCode: string } | null;
  user?: { name?: string | null; email?: string | null } | null;
  _count?: { items: number };
  items?: any[];
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function ReturnList() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  // "active" is every return still in circulation; "deleted" is the correction
  // view the stamp behind.
  const [view, setView] = useState<"active" | "deleted">("active");
  const [confirmTarget, setConfirmTarget] = useState<ReturnRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (typeFilter !== "all") {
      params.set("returnType", typeFilter);
    }
    if (view === "deleted") {
      params.set("deleted", "true");
    }
    return params.toString();
  }, [page, pageSize, search, typeFilter, view]);

  const { data, isLoading, mutate } = useSWR(
    `/returns?${queryString}`,
    fetcher
  );

  const returnsList: ReturnRow[] = useMemo(() => {
    return data?.data ?? [];
  }, [data?.data]);

  const totalReturns = data?.total ?? 0;

  // Both handlers run behind the shared ConfirmDialog: each one moves stock,
  // and neither should be dismissable mid-flight.
  const handleDelete = async (row: ReturnRow) => {
    setConfirmBusy(true);
    try {
      await api.delete(`/returns/${row.id}`);
      toast.success("Return deleted and stock reversed successfully");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete return");
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleRestore = async (row: ReturnRow) => {
    setConfirmBusy(true);
    try {
      await api.post(`/returns/${row.id}/restore`);
      toast.success(`Return "${row.returnCode}" restored and stock re-applied`);
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to restore return");
    } finally {
      setConfirmBusy(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "SALE":
        return <Badge className="badge badge-info">Sale Return</Badge>;
      case "PURCHASE":
        return <Badge className="badge badge-purple">Purchase Return</Badge>;
      case "DAMAGED":
        return <Badge variant="destructive" className="badge badge-danger">Damaged</Badge>;
      case "EXPIRED":
        return <Badge variant="destructive" className="badge badge-danger">Expired</Badge>;
      default:
        return <Badge variant="secondary" className="badge badge-gray">{type}</Badge>;
    }
  };

  const columns = useMemo<ColumnDef<ReturnRow, any>[]>(
    () => [
      {
        accessorKey: "returnCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary">
            {row.original.returnCode}
          </span>
        ),
      },
      {
        accessorKey: "returnType",
        header: "Type",
        cell: ({ row }) => (
          <div>
            {getTypeBadge(row.original.returnType)}
            <span className="font-mono text-xs text-primary font-medium block mt-1">
              {row.original.returnCode}
            </span>
          </div>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        cell: ({ row }) => {
          const r = row.original;
          if (r.sale?.saleCode) {
            return (
              <span className="font-mono text-xs text-muted-foreground">
                Sale: {r.sale.saleCode}
              </span>
            );
          }
          if (r.purchase?.purchaseCode) {
            return (
              <span className="font-mono text-xs text-muted-foreground">
                PO: {r.purchase.purchaseCode}
              </span>
            );
          }
          return <span className="text-xs text-muted-foreground">Direct Write-off</span>;
        },
      },
      {
        accessorKey: "returnDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.returnDate)}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md">
            {row.original._count?.items ?? row.original.items?.length ?? 0} pcs
          </span>
        ),
      },
      {
        id: "user",
        header: "Created By",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.user?.name || row.original.user?.email || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const ret = row.original;
          return view === "deleted" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
              onClick={() => setConfirmTarget(ret)}
              disabled={confirmBusy}
            >
              <span className="sr-only">Restore</span>
              <RotateCw className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
              onClick={() => setConfirmTarget(ret)}
              disabled={confirmBusy}
            >
              <span className="sr-only">Delete</span>
              <Trash2 className="size-3.5" />
            </Button>
          );
        },
      },
    ],
    [view, confirmBusy]
  );

  const visibleColumns = useMemo(
    () => columns.filter((col: any) => col.header !== "Code"),
    [columns]
  );

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Invenza Breadcrumb & Action Header */}
      <ListPageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-muted-foreground">Inventory</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Returns &amp; Write-offs</span>
          </>
        }
        title="Returns &amp; Write-offs"
        subtitle="Manage customer handbacks, vendor returns, and stock disposal write-offs"
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
            <Link to="/returns/new">
              <Button size="sm" className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
                <Plus className="size-4 mr-2" />
                New Return
              </Button>
            </Link>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Returns",
            value: isLoading ? "—" : totalReturns,
            sublabel: "Processed return events",
            icon: <RotateCw className="size-6" />,
          },
          {
            label: "Sale Handbacks",
            value: isLoading
              ? "—"
              : returnsList.filter((r) => r.returnType === "SALE").length,
            sublabel: "Customer returns processed",
            icon: <RotateCw className="size-6" />,
            tone: "success",
          },
          {
            label: "Disposal Write-offs",
            value: isLoading
              ? "—"
              : returnsList.filter((r) => r.returnType === "DAMAGED" || r.returnType === "EXPIRED").length,
            sublabel: "Damaged & expired items",
            icon: <RotateCw className="size-6" />,
            tone: "warning",
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={returnsList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search returns by code...",
        }}
        filters={
          <>
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Return view">
              {(["active", "deleted"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={view === tab}
                  onClick={() => {
                    setView(tab);
                    setPage(1);
                  }}
                  className={`px-3 h-8 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                    view === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs rounded-lg bg-background">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="SALE">Sale Return</SelectItem>
              <SelectItem value="PURCHASE">Purchase Return</SelectItem>
              <SelectItem value="DAMAGED">Damaged</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
          </>
        }
        skeleton={
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        }
        table={
          <DataTable
            columns={visibleColumns}
            data={returnsList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <RotateCw className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {view === "deleted" ? "No deleted returns" : "No returns found"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || typeFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : view === "deleted"
                  ? "Deleted returns stay here until they are restored."
                  : "No returns or write-offs have been processed yet."}
            </p>
            {view === "active" && !search && typeFilter === "all" && (
              <Link to="/returns/new">
                <Button size="sm" className="h-9 rounded-md">
                  <Plus className="size-4 mr-2" />
                  New Return
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          view === "deleted"
            ? `Restore return "${confirmTarget?.returnCode ?? ""}"?`
            : `Delete return "${confirmTarget?.returnCode ?? ""}"?`
        }
        description={
          view === "deleted"
            ? "The stock movement will be re-applied and the return returns to the active list."
            : "The stock movement will be reversed and the return moves to the Deleted tab. You can restore it later."
        }
        confirmLabel={view === "deleted" ? "Restore return" : "Delete return"}
        destructive={view === "active"}
        busy={confirmBusy}
        onConfirm={() => {
          if (!confirmTarget) return;
          if (view === "deleted") {
            void handleRestore(confirmTarget);
          } else {
            void handleDelete(confirmTarget);
          }
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
