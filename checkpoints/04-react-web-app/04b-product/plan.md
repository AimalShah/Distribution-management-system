# Checkpoint 4b — Product Pages: Plan

## Goal

Port product list and new product pages to React + Vite.

## Implementation

### Route: `apps/web/src/pages/ProductList.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@dms/ui";
import { api } from "../lib/api";

export default function ProductList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["products", page],
    queryFn: () => api.get(`/products?page=${page}`).then(r => r.data),
  });

  const columns = [
    { accessorKey: "productCode", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "category.name", header: "Category" },
    { accessorKey: "brand.name", header: "Brand" },
    { accessorKey: "unit", header: "Unit" },
    { accessorKey: "unitCost", header: "Cost" },
    { accessorKey: "unitPrice", header: "Price" },
    { accessorKey: "isActive", header: "Status" },
  ];

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      pageCount={data?.pageCount ?? 0}
      pageIndex={page - 1}
      pageSize={20}
      onPaginationChange={(p) => setPage(p + 1)}
    />
  );
}
```

### Route: `apps/web/src/pages/ProductNew.tsx`

Port `ProductForm` with react-hook-form + Zod validation. Use shadcn form components.

## Intentional Deviations

1. **Server-side pagination** — original was client-side; React version uses server-side pagination via DataTable
2. **React Query** — replaces SWR for data fetching
3. **Loading states** — added skeleton loaders
