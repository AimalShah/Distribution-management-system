# Checkpoint 4a — Dashboard: Source Review

## Source Review: `src/app/(app)/dashboard/page.tsx` + `src/components/dashboard/*`

### Page: `src/app/(app)/dashboard/page.tsx`

**Data fetched:**
- Stats (total products, inventory value, low stock count, recent sales)
- Sales chart data (last 30 days)
- Inventory chart data
- Low stock alerts
- Top products
- Recent activities

**Components used:**
- `Stats` — stat cards with icons
- `SalesChart` — Recharts line/area chart
- `InventoryChart` — Recharts chart
- `LowStockAlert` — list of low stock products
- `TopProducts` — top selling products
- `RecentActivities` — recent inventory movements

**Layout:**
- Grid layout with stat cards on top
- Charts in 2-column grid
- Low stock + top products side by side
- Recent activities at bottom

### Components

#### `Stats.tsx`
- Displays 4 stat cards: Total Products, Inventory Value, Low Stock Items, Total Sales
- Each card has icon, label, value, and trend indicator

#### `SalesChart.tsx`
- Recharts AreaChart showing sales over time
- Date range: last 30 days
- Shows total sales amount per day

#### `InventoryChart.tsx`
- Recharts chart showing inventory movements
- Bar chart with IN/OUT movements

#### `LowStockAlert.tsx`
- List of products below reorder level
- Shows product name, current qty, reorder level
- Link to inventory page

#### `TopProducts.tsx`
- List of top 5 selling products
- Shows product name, quantity sold, revenue

#### `RecentActivities.tsx`
- List of recent inventory log entries
- Shows movement type, product, quantity, timestamp

### Bugs/Assumptions

1. Dashboard fetches all data server-side (Next.js) — React version needs client-side data fetching
2. No loading states shown in components
3. Charts use Recharts which works in both Next.js and Vite
