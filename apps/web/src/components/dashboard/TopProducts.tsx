import { Link } from "react-router-dom";
import { ArrowUpRight, Package } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dms/ui";
import type { DashboardStats } from "../../types/dashboard";
import { formatCurrency, formatNumber } from "../../lib/format";

export function TopProducts({ products }: { products: DashboardStats["topProducts"] }) {
  return (
    <Card data-testid="top-products">
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>Best performing products this month</CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8" />
            No sales this month yet
          </div>
        ) : (
          <ol className="space-y-3">
            {products.map((product, index) => (
              <li
                key={product.productId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{product.name}</span>
                    {index < 3 && <Badge variant="secondary">#{index + 1}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(product.totalSold)} units sold
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(product.totalRevenue)}</span>
              </li>
            ))}
          </ol>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
          <Link to="/product">
            View All Products
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
