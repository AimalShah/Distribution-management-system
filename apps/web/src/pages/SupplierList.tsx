import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  Edit,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../lib/api";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SupplierDialog, type SupplierRow } from "../components/suppliers/SupplierDialog";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";
import { ListTablePanel } from "../components/list/ListTablePanel";

export default function SupplierList() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);

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
    `/suppliers?${queryString}`,
    fetcher
  );

  const suppliersList: SupplierRow[] = useMemo(() => {
    return data?.data ?? [];
  }, [data?.data]);

  const totalSuppliers = data?.total ?? 0;

  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (supplier: SupplierRow) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);

    try {
      await api.delete(`/suppliers/${confirmTarget.id}`);
      toast.success("Supplier removed successfully");
      setConfirmTarget(null);
      await mutate();
    } catch (err: any) {
      toast.error(failureMessage(err, "Failed to delete supplier"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<SupplierRow, any>[]>(
    () => [
      {
        accessorKey: "supplierCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-foreground">
            {row.original.supplierCode}
          </span>
        ),
      },
      {
        accessorKey: "companyName",
        header: "Company",
        cell: ({ row }) => (
          <div>
            <span className="font-semibold text-foreground text-xs block">
              {row.original.companyName}
            </span>
            <span className="font-mono text-xs text-primary font-medium">
              {row.original.supplierCode}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "contactPerson",
        header: "Contact Person",
        cell: ({ row }) => row.original.contactPerson,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email || "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.phone || "—"}</span>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => row.original.city || "—",
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const supplier = row.original;

          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                onClick={() => handleOpenEdit(supplier)}
              >
                <span className="sr-only">Edit</span>
                <Edit className="size-3.5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                onClick={() => setConfirmTarget({ id: supplier.id, label: supplier.companyName })}
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
      {/* Operational Breadcrumb & Action Header */}
      <ListPageHeader
        breadcrumb={
          <>
            <Link to="/" className="hover:text-primary transition-colors cursor-pointer">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-muted-foreground">Contacts & Business</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Suppliers</span>
          </>
        }
        title="Suppliers"
        subtitle="Manage vendor partners, supply chain contacts, and purchase origins"
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
            <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md shadow-sm cursor-pointer transition-all bg-amber-500 hover:bg-amber-600 text-stone-900">
              <Plus className="size-4 mr-2" />
              Add Supplier
            </Button>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Suppliers",
            value: isLoading ? "—" : totalSuppliers,
            sublabel: "Registered supply partners",
            icon: <Truck className="size-6" />,
          },
          {
            label: "Active Vendors",
            value: isLoading
              ? "—"
              : suppliersList.filter((s) => s.isActive).length,
            sublabel: "Fulfilling purchase orders",
            icon: <Building2 className="size-6" />,
            tone: "success",
            sublabelTone: "success",
          },
          {
            label: "Supply Reliability",
            value: "98.4%",
            sublabel: "On-time batch fulfillment",
            icon: <Truck className="size-6" />,
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={suppliersList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search suppliers by name or code...",
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
            data={suppliersList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <Truck className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No suppliers found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : "Start registering wholesale suppliers and vendors."}
            </p>
            {!search && statusFilter === "all" && (
              <Button size="sm" onClick={handleOpenCreate} className="h-9 rounded-md bg-amber-500 hover:bg-amber-600 text-stone-900">
                <Plus className="size-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </div>
        }
      />

      {/* Supplier Dialog (Add / Edit) */}
      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={selectedSupplier}
        onSuccess={() => mutate()}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        title={`Delete supplier "${confirmTarget?.label ?? ""}"?`}
        description="The supplier will be removed. Purchase history that references it is kept."
        confirmLabel="Delete supplier"
        destructive
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
