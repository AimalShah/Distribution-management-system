import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { formatCurrency } from "../../lib/format";
import type { Product } from "../../types/catalog";

export default function ProductList() {
  const products = usePaginated<Product>("/products");
  const revalidate = useRevalidate();
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      { accessorKey: "productCode", header: "Code" },
      { accessorKey: "name", header: "Name" },
      { id: "category", header: "Category", cell: ({ row }) => row.original.category?.name ?? "—" },
      { id: "brand", header: "Brand", cell: ({ row }) => row.original.brand?.name ?? "—" },
      { accessorKey: "unit", header: "Unit" },
      { accessorKey: "unitCost", header: "Cost", cell: ({ row }) => formatCurrency(row.original.unitCost) },
      { accessorKey: "unitPrice", header: "Price", cell: ({ row }) => formatCurrency(row.original.unitPrice) },
      {
        id: "stock",
        header: "Stock",
        cell: ({ row }) => row.original.inventory?.quantityOnHand ?? 0,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${row.original.name}`}
              onClick={() => navigate(`/product/${row.original.id}/edit`)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              title={`Delete ${row.original.name}?`}
              description="The product is removed from the catalogue. A product that appears on a purchase, sale or return cannot be deleted."
              onConfirm={async () => {
                try {
                  await api.delete(`/products/${row.original.id}`);
                  toast.success("Product deleted");
                  await revalidate("/products", "/dashboard/stats");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
          </div>
        ),
      },
    ],
    [navigate, revalidate]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Products"
        description="Manage your product catalogue"
        actions={
          <Button asChild>
            <Link to="/product/new">
              <Plus className="mr-1 h-4 w-4" /> Add Product
            </Link>
          </Button>
        }
      />
      <SearchInput placeholder="Search by name or code" onSearch={products.setSearch} />
      {products.data && (
        <p className="text-sm text-muted-foreground">{products.data.total} products</p>
      )}
      <ResourceTable columns={columns} result={products} emptyMessage="No products yet." />
    </div>
  );
}
