# Checkpoint 4a — Dashboard: Plan

## Goal

Port the dashboard page to React + Vite with React Router.

## Implementation

### Route: `apps/web/src/pages/Dashboard.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { Stats } from "../components/dashboard/Stats";
import { SalesChart } from "../components/dashboard/SalesChart";
import { LowStockAlert } from "../components/dashboard/LowStockAlert";
import { TopProducts } from "../components/dashboard/TopProducts";
import { RecentActivities } from "../components/dashboard/RecentActivities";
import { api } from "../lib/api";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then(r => r.data),
  });

  const { data: salesChart } = useQuery({
    queryKey: ["sales-chart"],
    queryFn: () => api.get("/reports/sales/basic?days=30").then(r => r.data),
  });

  const { data: lowStock } = useQuery({
    queryKey: ["low-stock"],
    queryFn: () => api.get("/inventory/low-stock").then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <Stats stats={stats} />
      <div className="grid grid-cols-2 gap-6">
        <SalesChart data={salesChart} />
        <InventoryChart />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <LowStockAlert items={lowStock} />
        <TopProducts />
      </div>
      <RecentActivities />
    </div>
  );
}
```

### Components to port:
- `Stats.tsx` — stat cards (port directly, change data props)
- `SalesChart.tsx` — Recharts chart (port directly)
- `InventoryChart.tsx` — Recharts chart (port directly)
- `LowStockAlert.tsx` — low stock list (port directly)
- `TopProducts.tsx` — top products list (port directly)
- `RecentActivities.tsx` — activity feed (port directly)

### API endpoints needed:
- `GET /api/dashboard/stats` — aggregated stats
- `GET /api/reports/sales/basic?days=30` — sales chart data
- `GET /api/inventory/low-stock` — low stock items
- `GET /api/inventory/logs?limit=10` — recent activities

## Intentional Deviations

1. **Client-side fetching** — was server-side in Next.js; React version uses React Query
2. **Loading states** — added skeleton loaders (not in original)
3. **Error handling** — added error states (not in original)
