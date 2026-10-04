import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dms/ui";

export function LowStockAlert({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50" role="alert" data-testid="low-stock-alert">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-orange-100 p-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-lg text-orange-900">Low Stock Alert</CardTitle>
            <CardDescription className="text-orange-700">
              {count} {count === 1 ? "item needs" : "items need"} reordering
            </CardDescription>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="border-orange-200 text-orange-700">
          <Link to="/inventory">
            View Inventory
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-orange-700">
        Stock on hand is at or below the reorder level.
      </CardContent>
    </Card>
  );
}
