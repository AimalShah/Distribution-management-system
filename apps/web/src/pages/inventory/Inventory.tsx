import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@dms/ui";
import { PageHeader } from "../../components/layout/PageHeader";
import { ResourceTable } from "../../components/common/ResourceTable";
import { NativeSelect } from "../../components/common/NativeSelect";
import { listPath, usePaginated, type Paginated } from "../../hooks/use-paginated";
import { formatDate } from "../../lib/format";
import { OPTIONS_PAGE_SIZE, type Product } from "../../types/catalog";
import type { InventoryLogRow, InventoryRow } from "../../types/inventory";
import { AddInventoryDialog, AdjustInventoryDialog } from "./InventoryDialogs";

function InventoryTable() {
  const inventory = usePaginated<InventoryRow>("/inventory");
  const columns = useMemo<ColumnDef<InventoryRow>[]>(
    () => [
      { id: "code", header: "Code", cell: ({ row }) => row.original.product.productCode },
      { id: "product", header: "Product", cell: ({ row }) => row.original.product.name },
      { accessorKey: "quantityOnHand", header: "On hand" },
      { accessorKey: "quantityReserved", header: "Reserved" },
      { accessorKey: "reorderLevel", header: "Reorder at" },
      { id: "max", header: "Max", cell: ({ row }) => row.original.maxStockLevel ?? "—" },
      {
        id: "status",
        header: "Status",
        // Same rule as the server's low-stock list and the dashboard alert.
        cell: ({ row }) =>
          row.original.quantityOnHand <= row.original.reorderLevel ? (
            <Badge variant="destructive">Low</Badge>
          ) : (
            <Badge variant="secondary">OK</Badge>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <AdjustInventoryDialog item={row.original} />
          </div>
        ),
      },
    ],
    []
  );
  return <ResourceTable columns={columns} result={inventory} emptyMessage="No inventory tracked yet." />;
}

function InventoryLogsTable() {
  const [productId, setProductId] = useState("");
  const logs = usePaginated<InventoryLogRow>("/inventory/logs", { productId: productId || undefined });
  const products = useSWR<Paginated<Product>>(listPath("/products", { pageSize: OPTIONS_PAGE_SIZE }));

  const columns = useMemo<ColumnDef<InventoryLogRow>[]>(
    () => [
      { id: "date", header: "Date", cell: ({ row }) => formatDate(row.original.createdAt) },
      { id: "product", header: "Product", cell: ({ row }) => row.original.product.name },
      { accessorKey: "movementType", header: "Movement" },
      { accessorKey: "quantity", header: "Quantity" },
      {
        id: "change",
        header: "Stock",
        cell: ({ row }) => `${row.original.previousQty} → ${row.original.newQty}`,
      },
      { id: "reason", header: "Reason", cell: ({ row }) => row.original.reason ?? "—" },
      { id: "user", header: "By", cell: ({ row }) => row.original.user.name },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex max-w-sm items-center gap-2">
        <Label htmlFor="log-product" className="shrink-0">
          Product
        </Label>
        <NativeSelect
          id="log-product"
          value={productId}
          onChange={(event) => {
            setProductId(event.target.value);
            logs.setPage(1);
          }}
        >
          <option value="">All products</option>
          {products.data?.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ResourceTable columns={columns} result={logs} emptyMessage="No stock movements yet." />
    </div>
  );
}

export default function Inventory() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader title="Inventory" description="Stock on hand and every movement" actions={<AddInventoryDialog />} />
      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="logs">Movement Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryTable />
        </TabsContent>
        <TabsContent value="logs">
          <InventoryLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
