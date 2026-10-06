import { useState, useMemo } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CreditCard,
  Edit,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
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
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatMoney } from "../lib/format";
import { CustomerDialog, type CustomerRow } from "../components/customers/CustomerDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";
import { ListTablePanel } from "../components/list/ListTablePanel";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function CustomerList() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (statusFilter !== "all") {
      params.set("isActive", statusFilter);
    }
    return params.toString();
  }, [page, pageSize, search, statusFilter]);

  const { data, isLoading, mutate } = useSWR(
    `/customers?${queryString}`,
    fetcher
  );

  const customersList: CustomerRow[] = useMemo(() => {
    return data?.data ?? [];
  }, [data?.data]);

  const totalCustomers = data?.total ?? 0;

  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      await api.delete(`/customers/${confirmTarget.id}`);
      toast.success("Customer removed successfully");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Failed to delete customer");
    } finally {
      setConfirmBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<CustomerRow, any>[]>(
    () => [
      {
        accessorKey: "customerCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-foreground">
            {row.original.customerCode}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const name = row.original.name;
          return (
            <div className="flex items-center gap-3">
              <div>
                <span className="font-semibold text-foreground text-xs block">{name}</span>
                <span className="font-mono text-xs text-primary font-medium">{row.original.customerCode}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.email || "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.phone || "—"}</span>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => (
          <span className="text-xs text-foreground">{row.original.city || "—"}</span>
        ),
      },
      {
        accessorKey: "creditLimit",
        header: "Credit Limit",
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-primary">
            {row.original.creditLimit !== null && row.original.creditLimit !== undefined
              ? formatMoney(row.original.creditLimit)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="badge badge-success">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="badge badge-gray">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const customer = row.original;
          return (
            <div className="flex items-center gap-1">
              <Link
                to={`/customers/${customer.id}/ledger`}
                className="inline-flex items-center justify-center size-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={`Open ledger for ${customer.name}`}
              >
                <BookOpen className="size-3.5 text-emerald-600" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                onClick={() => handleOpenEdit(customer)}
              >
                <span className="sr-only">Edit</span>
                <Edit className="size-3.5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                onClick={() => setConfirmTarget({ id: customer.id, label: customer.name })}
              >
                <span className="sr-only">Delete</span>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
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
            <span className="hover:text-primary transition-colors cursor-pointer">
              Dashboard
            </span>
            <span>/</span>
            <span className="text-muted-foreground">CRM</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Customers</span>
          </>
        }
        title="Customer Directory"
        subtitle="Manage distribution client directory, contact records, and credit parameters"
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
            <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
              <Plus className="size-4 mr-2" />
              Add Customer
            </Button>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Customers",
            value: isLoading ? "—" : totalCustomers,
            sublabel: "Registered client accounts",
            icon: <Users className="size-6" />,
          },
          {
            label: "Active Accounts",
            value: isLoading
              ? "—"
              : customersList.filter((c) => c.isActive).length,
            sublabel: "Eligible for purchase credit",
            icon: <CreditCard className="size-6" />,
            tone: "success",
            sublabelTone: "success",
          },
          {
            label: "Credit Limit Managed",
            value: isLoading
              ? "—"
              : formatMoney(customersList.reduce((acc, c) => acc + (c.creditLimit || 0), 0)),
            sublabel: "Aggregate credit ceiling",
            icon: <CreditCard className="size-6" />,
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={customersList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search customers by name or code...",
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
              <SelectItem value="true">Active Only</SelectItem>
              <SelectItem value="false">Inactive Only</SelectItem>
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
            data={customersList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <Users className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No customers found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : "Start registering customers to initiate orders and billing."}
            </p>
            {!search && statusFilter === "all" && (
              <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md">
                <Plus className="size-4 mr-2" />
                Add Customer
              </Button>
            )}
          </div>
        }
      />

      {/* Customer Dialog (Add / Edit) */}
      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={selectedCustomer}
        onSuccess={() => mutate()}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Delete customer "${confirmTarget?.label ?? ""}"?`}
        description="Only customers without sales history or payments on record can be removed. Otherwise set them inactive instead."
        confirmLabel="Delete customer"
        destructive
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
