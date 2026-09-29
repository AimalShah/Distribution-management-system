"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function LowStockAlert({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-orange-900 text-lg">
                Low Stock Alert
              </CardTitle>
              <CardDescription className="text-orange-700">
                {count} {count === 1 ? "item" : "items"} need
                {count === 1 ? "s" : ""} reordering
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-700">
                Some products are running low on stock and may need to be
                reordered soon.
              </span>
            </div>
            <Link href="/inventory">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                View Inventory
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
  );
}
