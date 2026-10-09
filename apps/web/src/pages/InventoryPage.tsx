import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  Clock,
  History,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dms/ui";
import { fetcher } from "../lib/api";
import { formatDate } from "../lib/format";
import { AdjustStockDialog, type InventoryItemSummary } from "../components/inventory/AdjustStockDialog";
import { AddInventoryDialog } from "../components/inventory/AddInventoryDialog";
import { Batches } from "./inventory/Batches";
import { PageHead } from "../components/list/PageHead";
import { ListTablePanel } from "../components/list/ListTablePanel";
import { StatChip } from "../components/list/StatChip";

export interface InventoryRow {
  id: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderLevel: number;
  maxStockLevel?: number | null;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    productCode: string;
    unit?: string;
  };
  _count?: {
    logs: number;
  };
}

export interface InventoryLogRow {
  id: string;
  inventoryId: string;
  productId: string;
  userId: string;
  movementType: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    productCode: string;
  };
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "inventory";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");

    if (tabParam && (tabParam === "inventory" || tabParam === "logs" || tabParam === "batches")) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Inventory Table State
  const [inventoryPage, setInventoryPage] = useState(1);
  const inventoryPageSize = 20;
  const [inventorySearch, setInventorySearch] = useState("");

  // Dialog states
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Logs Table State
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 20;

  // Data fetching
  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    mutate: mutateInventory,
  } = useSWR(
    `/inventory?page=${inventoryPage}&pageSize=${inventoryPageSize}`,
    fetcher
  );

  const {
    data: logsData,
    isLoading: logsLoading,
    mutate: mutateLogs,
  } = useSWR(
    `/inventory/logs?page=${logPage}&pageSize=${logPageSize}`,
    fetcher
  );

  const inventoryItems: InventoryRow[] = useMemo(() => {
    let items: InventoryRow[] = inventoryData?.data ?? [];

    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      items = items.filter(
        (it) =>
          it.product?.name.toLowerCase().includes(q) ||
          it.product?.productCode.toLowerCase().includes(q)
      );
    }

    return items;
  }, [inventoryData?.data, inventorySearch]);

  const logItems: InventoryLogRow[] = useMemo(() => {
    return logsData?.data ?? [];
  }, [logsData?.data]);

  const totalStockItems = inventoryData?.total ?? 0;

  const lowStockCount = useMemo(() => {
    return (inventoryData?.data ?? []).filter(
      (it: InventoryRow) => it.quantityOnHand <= it.reorderLevel
    ).length;
  }, [inventoryData?.data]);

  const handleOpenAdjust = (item: InventoryRow) => {
    setSelectedItem({
      id: item.id,
      quantityOnHand: item.quantityOnHand,
      product: item.product,
    });
    setAdjustOpen(true);
  };

  const handleRefresh = async () => {
    await Promise.all([mutateInventory(), mutateLogs()]);
  };

  // Inventory Columns
  const inventoryColumns = useMemo<ColumnDef<InventoryRow, any>[]>(
    () => [
      {
        accessorKey: "product.name",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-foreground block">
              {row.original.product?.name || "Unknown Product"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {row.original.product?.productCode || "—"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "quantityOnHand",
        header: "On Hand",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.quantityOnHand}
          </span>
        ),
      },
      {
        accessorKey: "quantityReserved",
        header: "Reserved",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.quantityReserved ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "reorderLevel",
        header: "Reorder Level",
        cell: ({ row }) => row.original.reorderLevel ?? 0,
      },
      {
        accessorKey: "maxStockLevel",
        header: "Max Stock",
        cell: ({ row }) => row.original.maxStockLevel ?? "—",
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const item = row.original;

          if (item.quantityOnHand <= 0) {
            return <Badge variant="destructive">Out of Stock</Badge>;
          }

          if (item.quantityOnHand <= item.reorderLevel) {
            return (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                Low Stock
              </Badge>
            );
          }

          return (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              In Stock
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAdjust(row.original)}
            className="h-8 gap-2 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <SlidersHorizontal className="size-3.5 text-primary" />
            Adjust
          </Button>
        ),
      },
    ],
    []
  );

  // Movement Log Columns
  const logColumns = useMemo<ColumnDef<InventoryLogRow, any>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "product.name",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <span className="font-semibold text-foreground block text-xs">
              {row.original.product?.name || "—"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {row.original.product?.productCode}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "movementType",
        header: "Movement",
        cell: ({ row }) => {
          const type = row.original.movementType;
          if (type === "IN" || type === "RETURN") {
            return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">{type}</Badge>;
          }
          if (type === "DAMAGED" || type === "EXPIRED") {
            return <Badge variant="destructive">{type}</Badge>;
          }
          return <Badge variant="secondary">{type}</Badge>;
        },
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground text-xs">
            {row.original.quantity}
          </span>
        ),
      },
      {
        accessorKey: "previousQty",
        header: "Previous",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.previousQty}</span>
        ),
      },
      {
        accessorKey: "newQty",
        header: "New",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-foreground">{row.original.newQty}</span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-xs truncate block">
            {row.original.reason || "—"}
          </span>
        ),
      },
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.user?.name || row.original.user?.email || "System"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5 animate-slideInUp">
      {/* Operational Breadcrumb & Action Header */}
      <PageHead
        title="Stock &amp; Inventory"
        subtitle="Monitor product availability, adjust stock levels, and review movement audits"
        breadcrumb={
          <>
            <Link to="/" className="hover:text-amber-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-stone-400">Stock &amp; Catalog</span>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={inventoryLoading || logsLoading}
              className="h-8"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Inventory
            </Button>
          </>
        }
      />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatChip label="Tracked Products" value={inventoryLoading ? "—" : totalStockItems} />
        <StatChip label="Low Stock" value={inventoryLoading ? "—" : lowStockCount} accent="amber" />
        <StatChip label="Healthy" value={inventoryLoading ? "—" : Math.max(0, totalStockItems - lowStockCount)} accent="green" />
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 rounded-xl">
          <TabsTrigger value="inventory" className="gap-2 rounded-lg text-xs font-medium">
            <Boxes className="size-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="batches" className="gap-2 rounded-lg text-xs font-medium">
            <Clock className="size-4" />
            Stock Batches & Lots
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 rounded-lg text-xs font-medium">
            <History className="size-4" />
            Movement Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Inventory Table */}
        <TabsContent value="inventory" className="space-y-4">
          <ListTablePanel
            isLoading={inventoryLoading}
            isEmpty={inventoryItems.length === 0}
            search={{
              value: inventorySearch,
              onChange: (value) => {
                setInventorySearch(value);
                setInventoryPage(1);
              },
              placeholder: "Search stock by product name or code...",
            }}
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
                columns={inventoryColumns}
                data={inventoryItems}
                pageCount={inventoryData?.pageCount ?? 1}
                pageIndex={inventoryPage - 1}
                pageSize={inventoryPageSize}
                onPaginationChange={(nextPage) => setInventoryPage(nextPage + 1)}
              />
            }
            empty={
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                  <Boxes className="size-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No inventory records found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                  {inventorySearch
                    ? "No stock records matched your search query."
                    : "Start tracking inventory levels by adding stock records for catalog products."}
                </p>
                {!inventorySearch && (
                  <Button size="sm" onClick={() => setAddOpen(true)} className="h-9 rounded-md">
                    <Plus className="size-4 mr-2" />
                    Add Inventory
                  </Button>
                )}
              </div>
            }
          />
        </TabsContent>

        {/* Tab 2: Movement Logs Table */}
        <TabsContent value="logs" className="space-y-4">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 sm:p-5">
              {logsLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : logItems.length > 0 ? (
                <DataTable
                  columns={logColumns}
                  data={logItems}
                  pageCount={logsData?.pageCount ?? 1}
                  pageIndex={logPage - 1}
                  pageSize={logPageSize}
                  onPaginationChange={(nextPage) => setLogPage(nextPage + 1)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ArrowUpDown className="size-12 text-muted-foreground mb-4" />
                  <h3 className="text-base font-semibold text-foreground">No movement logs found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Movement audits are generated automatically whenever purchases, sales, or adjustments occur.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Stock Batches & Lots */}
        <TabsContent value="batches" className="space-y-4">
          <Batches />
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Dialog */}
      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        inventoryItem={selectedItem}
        onSuccess={handleRefresh}
      />

      {/* Add Inventory Dialog */}
      <AddInventoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
