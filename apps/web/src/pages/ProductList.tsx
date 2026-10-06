import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  Filter,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
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
import { formatMoney } from "../lib/format";
import { ListPageHeader } from "../components/list/ListPageHeader";
import { StatTileRow } from "../components/list/StatTileRow";
import { ListTablePanel } from "../components/list/ListTablePanel";

export interface ProductItem {
  id: string;
  name: string;
  productCode: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
  isActive: boolean;
  categoryId?: string | null;
  brandId?: string | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function ProductList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Query params
  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (statusFilter === "active") {
      params.set("isActive", "true");
    } else if (statusFilter === "inactive") {
      params.set("isActive", "false");
    }
    return params.toString();
  }, [page, pageSize, search, statusFilter]);

  const { data, isLoading, mutate } = useSWR(
    `/products?${queryString}`,
    fetcher
  );

  // Categories list for filter dropdown
  const { data: categoriesData } = useSWR("/categories?page=1&pageSize=100", fetcher);
  const categories: { id: string; name: string }[] = categoriesData?.data ?? [];

  // Filter client-side by category if category filter is active (server supports isActive & search)
  const productList: ProductItem[] = useMemo(() => {
    const raw: ProductItem[] = data?.data ?? [];
    if (categoryFilter === "all") return raw;
    return raw.filter(
      (p) => p.category?.id === categoryFilter || p.categoryId === categoryFilter
    );
  }, [data?.data, categoryFilter]);

  const totalProducts = data?.total ?? 0;
  const activeProducts = (data?.data ?? []).filter((p: ProductItem) => p.isActive).length;

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted successfully");
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete product");
    }
  };

  const columns = useMemo<ColumnDef<ProductItem, any>[]>(
    () => [
      {
        accessorKey: "productCode",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-foreground">
            {row.original.productCode}
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
                <span className="font-semibold text-foreground block">
                  {name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {row.original.productCode}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "category.name",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-xs font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md">
            {row.original.category?.name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "brand.name",
        header: "Brand",
        cell: ({ row }) => row.original.brand?.name || "—",
      },
      {
        accessorKey: "unit",
        header: "Unit",
        cell: ({ row }) => (
          <span className="uppercase text-xs text-muted-foreground font-semibold">
            {row.original.unit}
          </span>
        ),
      },
      {
        accessorKey: "unitCost",
        header: "Cost",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatMoney(row.original.unitCost)}
          </span>
        ),
      },
      {
        accessorKey: "unitPrice",
        header: "Price",
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {formatMoney(row.original.unitPrice)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? "default" : "secondary"}
            className={
              row.original.isActive
                ? "badge badge-success"
                : "badge badge-gray"
            }
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => navigate(`/products/${product.id}/edit`)}
                  className="cursor-pointer font-medium"
                >
                  <Edit className="size-4 mr-2 text-primary" />
                  Edit Product
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(product.id, product.name)}
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
            <span className="text-muted-foreground">Inventory</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Products</span>
          </>
        }
        title="Products Catalog"
        subtitle="Manage your inventory items, pricing, SKUs, and stock visibility"
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
            <Link to="/products/new">
              <Button size="sm" className="h-9 rounded-md shadow-sm cursor-pointer transition-all">
                <Plus className="size-4 mr-2" />
                Add Product
              </Button>
            </Link>
          </>
        }
      />

      {/* Invenza Stat Metric Cards */}
      <StatTileRow
        tiles={[
          {
            label: "Total Products",
            value: isLoading ? "—" : totalProducts,
            sublabel: "In product catalog",
            icon: <Package className="size-6" />,
          },
          {
            label: "Active Products",
            value: isLoading ? "—" : activeProducts,
            sublabel: "Ready for distribution",
            icon: <TrendingUp className="size-6" />,
            tone: "success",
            sublabelTone: "success",
          },
          {
            label: "Product Categories",
            value: categories.length,
            sublabel: "Active classifications",
            icon: <Filter className="size-6" />,
          },
        ]}
      />

      {/* Filter and Table Card */}
      <ListTablePanel
        isLoading={isLoading}
        isEmpty={productList.length === 0}
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Search products by code or name...",
        }}
        filters={
          <>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px] h-9 text-xs rounded-lg bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
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
            data={productList}
            pageCount={data?.pageCount ?? 1}
            pageIndex={page - 1}
            pageSize={pageSize}
            onPaginationChange={(nextPage) => setPage(nextPage + 1)}
          />
        }
        empty={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
              <Package className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No products found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your search query or filter options."
                : "Get started by creating your first product in the catalog."}
            </p>
            {!search && statusFilter === "all" && categoryFilter === "all" && (
              <Link to="/products/new">
                <Button size="sm" className="h-9 rounded-md">
                  <Plus className="size-4 mr-2" />
                  Add Your First Product
                </Button>
              </Link>
            )}
          </div>
        }
      />
    </div>
  );
}
