import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
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

export interface PurchaseItemRow {
  id: string;
  purchaseCode: string;
  supplierId: string;
  totalAmount: number;
  taxAmount?: number | null;
  discount?: number | null;
  status: string;
  purchaseDate: string;
  createdAt: string;
  supplier: { id: string; companyName: string };
  _count?: { purchaseItems: number };
  purchaseItems?: any[];
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function PurchaseList() {
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
    return params.toString();
  }, [page, pageSize, search]);

  const { data, isLoading, mutate } = useSWR(
    `/purchases?${queryString}`,
    fetcher
  );

  const purchaseList: PurchaseItemRow[] = useMemo(() => {
    const raw: PurchaseItemRow[] = data?.data ?? [];
    if (statusFilter === "all") return raw;
    return raw.filter((p) => p.status.toLowerCase() === statusFilter.toLowerCase());
  }, [data?.data, statusFilter]);

  const totalPurchases = data?.total ?? 0;
  const totalSpent = (data?.data ?? []).reduce(
    (sum: number, p: PurchaseItemRow) => sum + (p.totalAmount || 0),
    0
  );

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete purchase order "${code}"?`)) {
      return;
    }
    try {
      await api.delete(`/purchases/${id}`);
      toast.success("Purchase order deleted successfully");
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete purchase order");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Badge className="badge badge-info">
            Approved
          </Badge>
        );
      case "received":
      case "completed":
        return (
          <Badge className="badge badge-success">
            {status}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive" className="badge badge-danger">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="badge badge-warning">{status}</Badge>;
    }
  };

  const columns = useMemo<ColumnDef<PurchaseItemRow, any>[]>(
    () => [
      {
        accessorKey: "purchaseCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary">
            {row.original.purchaseCode}
          </span>
        ),
      },
      {
        accessorKey: "supplier.companyName",
        header: "Supplier",
        cell: ({ row }) => (
          <div>
            <span className="font-semibold text-foreground text-xs block">
              {row.original.supplier?.companyName || "—"}
            </span>
            <span className="font-mono text-xs text-primary font-medium">
              {row.original.purchaseCode}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "purchaseDate",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.purchaseDate),
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) =>
          row.original._count?.purchaseItems ??
          row.original.purchaseItems?.length ??
          0,
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
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
          const purchase = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                  className="cursor-pointer"
                >
                  <Edit className="size-4 mr-2" />
                  Edit Order
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(purchase.id, purchase.purchaseCode)}
                  className="cursor-pointer text-destructive focus:text-destructive"
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
            <span className="text-muted-foreground">Purchases</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Orders</span>
          </>
        }
        title="Purchase Orders"
        subtitle="Manage incoming inventory, purchase orders, and supplier receipts"
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
            <Link to="/purchases/new">
              <Button size="sm" className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
                <Plus className="size-4 mr-2" />
                New Purchase Order
              </Button>
            </Link>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Orders",
            value: isLoading ? "—" : totalPurchases,
            sublabel: "Supplier purchase requests",
            icon: <ShoppingCart className="size-6" />,
          },
          {
            label: "Page Volume",
            value: isLoading ? "—" : formatMoney(totalSpent),
            sublabel: "Current view commitment",
            icon: <ShoppingCart className="size-6" />,
            tone: "success",
          },
          {
            label: "Receipt Status",
            value: isLoading
              ? "—"
              : `${purchaseList.filter(p => p.status.toLowerCase() === 'received' || p.status.toLowerCase() === 'completed').length} / ${purchaseList.length}`,
            sublabel: "Received at warehouse",
            icon: <ShoppingCart className="size-6" />,
            sublabelTone: "success",
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={purchaseList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search purchase orders...",
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
            data={purchaseList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <ShoppingCart className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No purchase orders found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : "Get started by creating your first purchase order."}
            </p>
            {!search && statusFilter === "all" && (
              <Link to="/purchases/new">
                <Button size="sm" className="h-9 rounded-md">
                  <Plus className="size-4 mr-2" />
                  New Purchase Order
                </Button>
              </Link>
            )}
          </div>
        }
      />
    </div>
  );
}
