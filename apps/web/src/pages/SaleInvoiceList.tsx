import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Edit,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
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
  saleDate: string;
  createdAt: string;
  customer?: { id: string; name: string };
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
    return params.toString();
  }, [page, pageSize, search, statusFilter]);

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

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice "${code}"?`)) {
      return;
    }
    try {
      await api.delete(`/sales/${id}`);
      toast.success("Sale invoice deleted successfully");
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete sale invoice");
    }
  };

  const handlePrint = (id: string) => {
    window.open(`/api/sales/${id}/print`, "_blank");
  };

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/sales/${id}/pdf`, "_blank");
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
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.status),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const sale = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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
                  onClick={() => navigate(`/sales/${sale.id}/edit`)}
                  className="cursor-pointer font-medium"
                >
                  <Edit className="size-4 mr-2" />
                  Edit Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(sale.id, sale.saleCode)}
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
    [navigate]
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
            <h3 className="text-base font-semibold text-foreground">No sale invoices found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : "Get started by generating your first customer sales invoice."}
            </p>
            {!search && statusFilter === "all" && (
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
    </div>
  );
}
