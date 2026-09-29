# Checkpoint 4i — Reports Page: Plan

## Goal

Port reports page to React + Vite.

## Implementation

### Route: `apps/web/src/pages/Reports.tsx`

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateRangePicker } from "@dms/ui";
import { api } from "../lib/api";

export default function Reports() {
  const [dateRange, setDateRange] = useState({ from: ..., to: ... });
  const [reportType, setReportType] = useState("sales");

  const { data } = useQuery({
    queryKey: ["reports", reportType, dateRange],
    queryFn: () => api.get(`/reports/${reportType}/basic?startDate=${dateRange.from}&endDate=${dateRange.to}`).then(r => r.data),
  });

  return (
    <div>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsTrigger value="sales">Sales</TabsTrigger>
        <TabsTrigger value="purchase">Purchase</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
      </Tabs>
      {/* Report content based on type */}
    </div>
  );
}
```

## Intentional Deviations

1. **React Query** — replaces SWR
2. **Server-side date filtering** — was client-side
