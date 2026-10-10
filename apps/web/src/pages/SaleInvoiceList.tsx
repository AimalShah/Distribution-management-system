import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  ChevronDown,
  CreditCard,
  Download,
  Edit,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCw,
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
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@dms/ui";
import { api, failureMessage, fetcher, shortfallLine, toFailure } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { waLink } from "../lib/whatsapp";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { ListTablePanel } from "../components/list/ListTablePanel";
import { RecordPaymentDialog, type QuickPayTarget } from "../components/sales/RecordPaymentDialog";

// High-contrast, refined KPI card matching the Dashboard operational cockpit style
function DashboardKpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "blue" | "amber" | "rose";
  loading?: boolean;
}) {
  const accentStyles = {
    emerald: {
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      indicator: "bg-emerald-500",
    },
    blue: {
      icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      indicator: "bg-sky-500",
    },
    amber: {
      icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      indicator: "bg-amber-500",
    },
    rose: {
      icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      indicator: "bg-rose-500",
    },
  }[accent];

  return (
    <Card className="border-border relative overflow-hidden bg-card transition-shadow hover:shadow-sm py-0 gap-0">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentStyles.indicator}`} />
      <CardContent className="p-4 pt-4.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="text-xl font-bold text-foreground mt-1 tracking-tight">
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                value
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentStyles.icon}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
    action: "delete" | "restore" | "cancel" | "uncancel" | "set_status";
    targetStatus?: string;
  } | null>(null);

  const [confirmBusy, setConfirmBusy] = useState(false);
  const [paymentDialogTarget, setPaymentDialogTarget] = useState<QuickPayTarget | null>(null);

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

  const totalCollectedOnPage = (data?.data ?? []).reduce(
    (sum: number, s: SaleInvoiceItemRow) => sum + (s.amountPaid || 0),
    0
  );

  const completedOrdersCount = salesList.filter((s) => s.status === "Completed").length;
  const pendingOrdersCount = salesList.filter((s) => s.status === "Pending").length;

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
      toast.error(failureMessage(err, "Failed to delete sale invoice"));
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
      // The refusal carries { productId, available, requested }: name the gap.
      const failure = toFailure(err, "Failed to restore sale invoice");

      toast.error(`${failure.message}${shortfallLine(failure)}`);
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
      toast.error(failureMessage(err, "Failed to cancel invoice"));
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
      toast.error(failureMessage(err, "Failed to un-cancel invoice"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleUpdateStatus = async (sale: SaleInvoiceItemRow, nextStatus: string) => {
    setConfirmBusy(true);

    try {
      await api.put(`/sales/${sale.id}`, { status: nextStatus });
      toast.success(`Invoice "${sale.saleCode}" status updated to ${nextStatus}`);
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, `Failed to update status to ${nextStatus}`));
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
      const detail = await api.get(`/sales/${sale.id}`);
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
      toast.error(failureMessage(err, "Failed to prepare the invoice message"));
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
  const getPaymentStatusText = (sale: SaleInvoiceItemRow) => {
    if (sale.status === "Cancelled") {
      return <span className="text-muted-foreground">—</span>;
    }

    const paid = sale.amountPaid ?? 0;
    const total = sale.totalAmount || 0;

    if (paid <= 0) {
      return <span className="text-muted-foreground font-medium">Unpaid</span>;
    }

    if (paid >= total) {
      return <span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid</span>;
    }

    return <span className="text-amber-600 dark:text-amber-400 font-medium">Partial</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            Completed
          </Badge>
        );
      case "Pending":
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Pending</Badge>;
      case "Cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
          const phone = row.original.customer?.phone;

          return (
            <div className="min-w-[130px]">
              <span className="font-semibold text-foreground text-xs block truncate">
                {name}
              </span>
              {phone && (
                <span className="text-[11px] text-muted-foreground block truncate">
                  {phone}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "saleDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.saleDate)}
          </span>
        ),
      },
      {
        id: "items",
        header: () => <div className="text-center">Items</div>,
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ row }) => (
          <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
            {row.original._count?.items ?? row.original.items?.length ?? 0} pcs
          </span>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: () => <div className="text-right">Total</div>,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => (
          <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {formatMoney(row.original.totalAmount)}
          </div>
        ),
      },
      {
        id: "paid",
        header: () => <div className="text-right">Paid & Settlement</div>,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => {
          const sale = row.original;
          const paid = sale.amountPaid ?? 0;
          const total = sale.totalAmount || 0;
          const percentage = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          const isCancelled = sale.status === "Cancelled";

          if (isCancelled) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }

          return (
            <div className="flex flex-col gap-1 min-w-[110px] max-w-[130px] ml-auto">
              <div className="text-left font-semibold font-mono tabular-nums text-foreground text-[11px] leading-tight">
                {formatMoney(paid)}
              </div>
              <Progress value={percentage} className="h-1 w-full bg-muted/80" />
              <div className="flex items-center gap-1 text-[10px] leading-tight text-left">
                <span className="text-muted-foreground font-mono tabular-nums">
                  {percentage}%
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>
                  {getPaymentStatusText(sale)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Status</div>,
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
        cell: ({ row }) => {
          const sale = row.original;
          const isCancelled = sale.status === "Cancelled";

          const statusBadge = (
            <Badge
              variant={
                sale.status === "Completed"
                  ? "default"
                  : sale.status === "Cancelled"
                    ? "destructive"
                    : "secondary"
              }
              className={`text-[11px] font-medium gap-1 cursor-pointer select-none py-0.5 px-2 transition-all ${
                sale.status === "Completed"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                  : sale.status === "Pending"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                    : "hover:opacity-90"
              }`}
            >
              <span>{sale.status}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Badge>
          );

          return (
            <div className="flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="outline-none focus:ring-1 focus:ring-ring rounded">
                    {statusBadge}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-36">
                  {/* Option 1: Pending */}
                  <DropdownMenuItem
                    disabled={sale.status === "Pending" || isCancelled}
                    onClick={() => {
                      if (sale.status !== "Pending") {
                        setConfirmTarget({ row: sale, action: "set_status", targetStatus: "Pending" });
                      }
                    }}
                    className="cursor-pointer text-xs font-medium"
                  >
                    <span className="size-2 rounded-full bg-amber-500 mr-2" />
                    Mark Pending
                  </DropdownMenuItem>

                  {/* Option 2: Completed */}
                  <DropdownMenuItem
                    disabled={sale.status === "Completed" || isCancelled}
                    onClick={() => {
                      if (sale.status !== "Completed") {
                        setConfirmTarget({ row: sale, action: "set_status", targetStatus: "Completed" });
                      }
                    }}
                    className="cursor-pointer text-xs font-medium"
                  >
                    <span className="size-2 rounded-full bg-emerald-500 mr-2" />
                    Mark Completed
                  </DropdownMenuItem>

                  {/* Option 3: Cancel / Un-cancel */}
                  {isCancelled ? (
                    <DropdownMenuItem
                      onClick={() => setConfirmTarget({ row: sale, action: "uncancel" })}
                      className="cursor-pointer text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <RotateCw className="size-3.5 mr-2" />
                      Un-cancel
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setConfirmTarget({ row: sale, action: "cancel" })}
                      className="cursor-pointer text-xs font-medium text-destructive focus:text-destructive"
                    >
                      <Ban className="size-3.5 mr-2" />
                      Cancel Invoice
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => {
          const sale = row.original;

          if (view === "deleted") {
            return (
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                  onClick={() => setConfirmTarget({ row: sale, action: "restore" })}
                  disabled={confirmBusy}
                  title="Restore invoice"
                >
                  <span className="sr-only">Restore</span>
                  <RotateCw className="size-3.5" />
                </Button>
              </div>
            );
          }

          const isCancelled = sale.status === "Cancelled";
          const paid = sale.amountPaid ?? 0;
          const total = sale.totalAmount || 0;
          const isFullyPaid = paid >= total;

          return (
            <div className="flex items-center justify-end gap-1">
              {/* Primary Action 1: Print */}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                onClick={() => handlePrint(sale.id)}
                title="Print invoice"
              >
                <Printer className="size-3.5" />
                <span className="sr-only">Print</span>
              </Button>

              {/* Primary Action 2: Edit (if not cancelled) */}
              {!isCancelled ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                  onClick={() => navigate(`/sales/${sale.id}/edit`)}
                  title="Edit invoice"
                >
                  <Edit className="size-3.5" />
                  <span className="sr-only">Edit</span>
                </Button>
              ) : null}

              {/* Primary Action 3: Quick Pay */}
              {!isCancelled && !isFullyPaid ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] gap-1 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                  onClick={() =>
                    setPaymentDialogTarget({
                      id: sale.id,
                      saleCode: sale.saleCode,
                      customerId: sale.customerId,
                      customerName: sale.customer?.name,
                      totalAmount: sale.totalAmount,
                      amountPaid: sale.amountPaid ?? 0,
                    })
                  }
                  title="Record payment for this invoice"
                >
                  <CreditCard className="size-3" />
                  <span>Pay</span>
                </Button>
              ) : null}

              {/* Overflow Dropdown for secondary actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                  >
                    <span className="sr-only">More actions</span>
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => handleDownloadPdf(sale.id)}
                    className="cursor-pointer font-medium"
                  >
                    <Download className="size-4 mr-2 text-sky-500" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleShare(sale)}
                    className="cursor-pointer font-medium"
                  >
                    <MessageCircle className="size-4 mr-2 text-emerald-500" />
                    Share on WhatsApp
                  </DropdownMenuItem>
                  {!isCancelled ? (
                    <DropdownMenuItem
                      onClick={() => setConfirmTarget({ row: sale, action: "cancel" })}
                      className="cursor-pointer font-medium"
                    >
                      <Ban className="size-4 mr-2 text-amber-500" />
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
            </div>
          );
        },
      },
    ],
    [navigate, view, confirmBusy]
  );

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Operational Breadcrumb & Action Header */}
      <ListPageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-muted-foreground">Daily Operations</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Sales & Invoices</span>
          </>
        }
        title="Sales & Invoices"
        subtitle="Manage customer orders, billing receipts, and balance collection"
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
              <Button size="sm" className="h-9 text-black bg-amber-500 hover:bg-amber-600 rounded-md shadow-sm cursor-pointer transition-all">
                <Plus className="size-4 mr-2" />
                New Sale Invoice
              </Button>
            </Link>
          </>
        }
      />

      {/* High-Contrast Operational KPI Cards matching Dashboard Cockpit Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardKpiCard
          label="Total Invoices"
          value={isLoading ? "—" : String(totalInvoices)}
          sublabel="Recorded transactions"
          icon={Receipt}
          accent="blue"
          loading={isLoading}
        />
        <DashboardKpiCard
          label="Page Sales Volume"
          value={isLoading ? "—" : formatMoney(totalVolume)}
          sublabel="Gross value in view"
          icon={FileText}
          accent="emerald"
          loading={isLoading}
        />
        <DashboardKpiCard
          label="Collected Amount"
          value={isLoading ? "—" : formatMoney(totalCollectedOnPage)}
          sublabel={`${totalVolume > 0 ? Math.round((totalCollectedOnPage / totalVolume) * 100) : 0}% settled on page`}
          icon={CreditCard}
          accent="amber"
          loading={isLoading}
        />
        <DashboardKpiCard
          label="Settlement Health"
          value={isLoading ? "—" : `${completedOrdersCount} / ${salesList.length}`}
          sublabel={`${pendingOrdersCount} pending collection`}
          icon={Receipt}
          accent="rose"
          loading={isLoading}
        />
      </div>

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
            columns={columns}
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
                <Button size="sm" className="h-9 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-900">
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
                : confirmTarget?.action === "set_status"
                  ? `Change status to "${confirmTarget?.targetStatus}"?`
                  : `Delete invoice "${confirmTarget?.row.saleCode ?? ""}"?`
        }
        description={
          confirmTarget?.action === "restore"
            ? "The stock this invoice took will be re-applied and it returns to the active list."
            : confirmTarget?.action === "cancel"
              ? "The invoice stops counting toward sales and the ledger until it is un-cancelled. Payments already recorded against it are refused first, so nothing settles a cancelled invoice."
              : confirmTarget?.action === "uncancel"
                ? "The invoice returns to the status it held before it was cancelled."
                : confirmTarget?.action === "set_status"
                  ? `Update invoice "${confirmTarget?.row.saleCode}" status from ${confirmTarget?.row.status} to ${confirmTarget?.targetStatus}.`
                  : "The stock this invoice took will be returned, the invoice moves to the Deleted tab, and it can be restored later. Invoices with payments or returns are refused."
        }
        confirmLabel={
          confirmTarget?.action === "restore"
            ? "Restore invoice"
            : confirmTarget?.action === "cancel"
              ? "Cancel invoice"
              : confirmTarget?.action === "uncancel"
                ? "Un-cancel invoice"
                : confirmTarget?.action === "set_status"
                  ? `Set to ${confirmTarget?.targetStatus}`
                  : "Delete invoice"
        }
        destructive={confirmTarget?.action === "delete" || confirmTarget?.action === "cancel"}
        busy={confirmBusy}
        onConfirm={() => {
          if (!confirmTarget) return;
          const { row, action, targetStatus } = confirmTarget;

          if (action === "restore") void handleRestore(row);
          else if (action === "cancel") void handleCancel(row);
          else if (action === "uncancel") void handleUncancel(row);
          else if (action === "set_status" && targetStatus) void handleUpdateStatus(row, targetStatus);
          else void handleDelete(row);
        }}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Record Payment Dialog for 1-click Pay action */}
      <RecordPaymentDialog
        open={paymentDialogTarget !== null}
        defaultSale={paymentDialogTarget}
        onClose={() => setPaymentDialogTarget(null)}
        onSuccess={() => void mutate()}
      />
    </div>
  );
}
