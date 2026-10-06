import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Download,
  Edit,
  FileText,
  Filter,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@dms/ui";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { waLink } from "../lib/whatsapp";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";
import { ListTablePanel } from "../components/list/ListTablePanel";

export interface SaleInvoiceItemRow {
  id: string;
  saleCode: string;
  customerId: string;
  totalAmount: number;
  taxAmount?: number | null;
  discount?: number | null;
  status: string;
  amountPaid?: number;
  saleDate: string;
  createdAt: string;
  customer?: { id: string; name: string; phone?: string | null };
  _count?: { items: number };
  items?: any[];
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function SaleInvoiceList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // The Deleted tab: stamped invoices, out of circulation but still on record.
  const [view, setView] = useState<"active" | "deleted">("active");
  const [confirmTarget, setConfirmTarget] = useState<{
    row: SaleInvoiceItemRow;
    action: "delete" | "restore" | "cancel" | "uncancel";
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (view === "deleted") {
      params.set("deleted", "true");
    }
    return params.toString();
  }, [page, pageSize, search, statusFilter, view]);

  const { data, isLoading, mutate } = useSWR(
    `/sales?${queryString}`,
    fetcher
  );

  const salesList: SaleInvoiceItemRow[] = useMemo(() => {
    return data?.data ?? [];
  }, [data?.data]);

  const totalInvoices = data?.total ?? 0;
  const totalVolume = (data?.data ?? []).reduce(
    (sum: number, s: SaleInvoiceItemRow) => sum + (s.totalAmount || 0),
    0
  );

  // Every action below — the two that move stock (delete, restore) and the two
  // that only flip the status (cancel, un-cancel) — runs behind the shared
  // ConfirmDialog with a busy state that no second click can get past.
  const handleDelete = async (row: SaleInvoiceItemRow) => {
    setConfirmBusy(true);
    try {
      await api.delete(`/sales/${row.id}`);
      toast.success("Invoice deleted, stock returned, and moved to the Deleted tab");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete sale invoice");
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleRestore = async (row: SaleInvoiceItemRow) => {
    setConfirmBusy(true);
    try {
      await api.post(`/sales/${row.id}/restore`);
      toast.success(`Invoice "${row.saleCode}" restored and stock re-applied`);
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to restore sale invoice");
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleCancel = async (sale: SaleInvoiceItemRow) => {
    setConfirmBusy(true);
    try {
      await api.post(`/sales/${sale.id}/cancel`);
      toast.success(`Invoice "${sale.saleCode}" cancelled`);
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to cancel invoice");
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleUncancel = async (sale: SaleInvoiceItemRow) => {
    setConfirmBusy(true);
    try {
      await api.post(`/sales/${sale.id}/uncancel`);
      toast.success(`Invoice "${sale.saleCode}" restored to its previous status`);
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to un-cancel invoice");
    } finally {
      setConfirmBusy(false);
    }
  };

  /**
   * Share the invoice as a WhatsApp message through a `wa.me` deep link: no
   * API token, and the sender reviews the text before it goes anywhere. With
   * no number on file the text is copied instead, so the button is never a
   * dead end.
   */
  const handleShare = async (sale: SaleInvoiceItemRow) => {
    try {
      const detail = await api.get(`/sales/${sale.id}`).then((r) => r.data);
      const total = detail.totalAmount ?? sale.totalAmount;
      const paid = detail.amountPaid ?? sale.amountPaid ?? 0;
      const text = [
        `Invoice ${detail.saleCode ?? sale.saleCode}`,
        `Customer: ${detail.customer?.name || "Walk-in Customer"}`,
        `Date: ${formatDate(detail.saleDate ?? sale.saleDate)}`,
        `Total: ${formatMoney(total)}`,
        `Paid: ${formatMoney(paid)}`,
        `Balance: ${formatMoney(Math.max(total - paid, 0))}`,
        `Status: ${detail.status ?? sale.status}`,
        "",
        "Thank you for your business.",
      ].join("\n");

      const link = waLink(detail.customer?.phone, text);
      if (link) {
        window.open(link, "_blank", "noopener");
      } else {
        await navigator.clipboard.writeText(text);
        toast.info("No WhatsApp number on file — the invoice summary was copied instead");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to prepare the invoice message");
    }
  };

  const handlePrint = (id: string) => {
    window.open(`/api/sales/${id}/print`, "_blank");
  };

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/sales/${id}/pdf`, "_blank");
  };

  /**
   * Derived, never stored: `amountPaid` against the invoice total is the only
   * honest answer to "is this settled?", so a payment that lands shows up
   * here without anyone editing a status field.
   */
  const getPaymentBadge = (sale: SaleInvoiceItemRow) => {
    if (sale.status === "Cancelled") {
      return <span className="text-xs text-muted-foreground">—</span>;
    }
    const paid = sale.amountPaid ?? 0;
    const total = sale.totalAmount || 0;
    if (paid <= 0) {
      return <Badge variant="secondary" className="badge badge-gray">Unpaid</Badge>;
    }
    if (paid >= total) {
      return <Badge className="badge badge-success">Paid</Badge>;
    }
    return <Badge variant="secondary" className="badge badge-warning">Partial</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="badge badge-success">
            Completed
          </Badge>
        );
      case "Pending":
        return <Badge variant="secondary" className="badge badge-warning">Pending</Badge>;
      case "Cancelled":
        return <Badge variant="destructive" className="badge badge-danger">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="badge badge-gray">{status}</Badge>;
    }
  };

  const columns = useMemo<ColumnDef<SaleInvoiceItemRow, any>[]>(
    () => [
      {
        accessorKey: "saleCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary">
            {row.original.saleCode}
          </span>
        ),
      },
      {
        accessorKey: "customer.name",
        header: "Customer",
        cell: ({ row }) => {
          const name = row.original.customer?.name || "Walk-in Customer";
          return (
            <div className="flex items-center gap-2">
              <div>
                <span className="font-semibold text-foreground text-xs block">
                  {name}
                </span>
                <span className="font-mono text-xs text-primary font-medium">
                  {row.original.saleCode}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "saleDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.saleDate)}
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
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground text-xs">
            {formatMoney(row.original.totalAmount)}
          </span>
        ),
      },
      {
        id: "paid",
        header: "Paid",
        cell: ({ row }) => {
          const sale = row.original;
          const paid = sale.amountPaid ?? 0;
          return (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {paid > 0 ? formatMoney(paid) : formatMoney(0)}
              </span>
              {getPaymentBadge(sale)}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const sale = row.original;

          if (view === "deleted") {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                onClick={() => setConfirmTarget({ row: sale, action: "restore" })}
                disabled={confirmBusy}
              >
                <span className="sr-only">Restore</span>
                <RotateCw className="size-3.5" />
              </Button>
            );
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => handlePrint(sale.id)}
                  className="cursor-pointer font-medium"
                >
                  <Printer className="size-4 mr-2 text-primary" />
                  Print Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDownloadPdf(sale.id)}
                  className="cursor-pointer font-medium"
                >
                  <Download className="size-4 mr-2 text-blue-500" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleShare(sale)}
                  className="cursor-pointer font-medium"
                >
                  <MessageCircle className="size-4 mr-2 text-emerald-500" />
                  Share on WhatsApp
                </DropdownMenuItem>
                {sale.status !== "Cancelled" && (
                  <DropdownMenuItem
                    onClick={() => navigate(`/sales/${sale.id}/edit`)}
                    className="cursor-pointer font-medium"
                  >
                    <Edit className="size-4 mr-2" />
                    Edit Invoice
                  </DropdownMenuItem>
                )}
                {sale.status !== "Cancelled" ? (
                  <DropdownMenuItem
                    onClick={() => setConfirmTarget({ row: sale, action: "cancel" })}
                    className="cursor-pointer font-medium"
                  >
                    <Ban className="size-4 mr-2 text-destructive" />
                    Cancel Invoice
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => setConfirmTarget({ row: sale, action: "uncancel" })}
                    className="cursor-pointer font-medium"
                  >
                    <RotateCw className="size-4 mr-2 text-emerald-500" />
                    Un-cancel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setConfirmTarget({ row: sale, action: "delete" })}
                  className="cursor-pointer text-destructive focus:text-destructive font-medium"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, view, confirmBusy]
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
            <span className="text-muted-foreground">Sales</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Invoices</span>
          </>
        }
        title="Sale Invoices"
        subtitle="Manage customer invoices, order fulfillment, and billing receipts"
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
            <Link to="/sales/new">
              <Button size="sm" className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
                <Plus className="size-4 mr-2" />
                New Sale Invoice
              </Button>
            </Link>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Invoices",
            value: isLoading ? "—" : totalInvoices,
            sublabel: "Issued transactions",
            icon: <Receipt className="size-6" />,
          },
          {
            label: "Page Volume",
            value: isLoading ? "—" : formatMoney(totalVolume),
            sublabel: "Current view value",
            icon: <FileText className="size-6" />,
            tone: "success",
          },
          {
            label: "Settlement Health",
            value: isLoading ? "—" : `${salesList.filter(s => s.status === 'Completed').length} / ${salesList.length}`,
            sublabel: "Completed orders",
            icon: <Receipt className="size-6" />,
            sublabelTone: "success",
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={salesList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search invoices by code or customer...",
        }}
        filters={
          <>
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Invoice view">
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
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
            data={salesList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <Receipt className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {view === "deleted" ? "No deleted invoices" : "No sale invoices found"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : view === "deleted"
                  ? "Deleted invoices stay here until they are restored."
                  : "Get started by generating your first customer sales invoice."}
            </p>
            {view === "active" && !search && statusFilter === "all" && (
              <Link to="/sales/new">
                <Button size="sm" className="h-9 rounded-md">
                  <Plus className="size-4 mr-2" />
                  New Sale Invoice
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title={
          confirmTarget?.action === "restore"
            ? `Restore invoice "${confirmTarget?.row.saleCode ?? ""}"?`
            : confirmTarget?.action === "cancel"
              ? `Cancel invoice "${confirmTarget?.row.saleCode ?? ""}"?`
              : confirmTarget?.action === "uncancel"
                ? `Un-cancel invoice "${confirmTarget?.row.saleCode ?? ""}"?`
                : `Delete invoice "${confirmTarget?.row.saleCode ?? ""}"?`
        }
        description={
          confirmTarget?.action === "restore"
            ? "The stock this invoice took will be re-applied and it returns to the active list."
            : confirmTarget?.action === "cancel"
              ? "The invoice stops counting toward sales and the ledger until it is un-cancelled. Payments already recorded against it are refused first, so nothing settles a cancelled invoice."
              : confirmTarget?.action === "uncancel"
                ? "The invoice returns to the status it held before it was cancelled."
                : "The stock this invoice took will be returned, the invoice moves to the Deleted tab, and it can be restored later. Invoices with payments or returns are refused."
        }
        confirmLabel={
          confirmTarget?.action === "restore"
            ? "Restore invoice"
            : confirmTarget?.action === "cancel"
              ? "Cancel invoice"
              : confirmTarget?.action === "uncancel"
                ? "Un-cancel invoice"
                : "Delete invoice"
        }
        destructive={confirmTarget?.action === "delete" || confirmTarget?.action === "cancel"}
        busy={confirmBusy}
        onConfirm={() => {
          if (!confirmTarget) return;
          const { row, action } = confirmTarget;
          if (action === "restore") void handleRestore(row);
          else if (action === "cancel") void handleCancel(row);
          else if (action === "uncancel") void handleUncancel(row);
          else void handleDelete(row);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
