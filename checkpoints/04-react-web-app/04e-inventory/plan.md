# Checkpoint 4e — Inventory Page: Plan

## Goal

Port inventory page to React + Vite with tabs.

## Implementation

### Route: `apps/web/src/pages/Inventory.tsx`

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dms/ui";

export default function Inventory() {
  return (
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
  );
}
```

### Components:
- `InventoryTable` — paginated table with adjust button
- `InventoryLogsTable` — paginated table with productId filter
- `AdjustInventoryDialog` — dialog for adjusting quantity
- `AddInventoryForm` — rebuilt against real schema (addresses gap analysis finding)

## Intentional Deviations

1. **Server-side pagination** — was client-side
2. **AddInventoryForm rebuilt** — fixed to match real schema
3. **React Query** — replaces SWR
