"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  TrendingUp,
  ArrowUpRight,
  DollarSign
} from "lucide-react";
import Link from "next/link";

type TopProduct = {
  product: {
    id: string;
    name: string;
  } | null;
  totalSold: number;
  totalRevenue: number;
};

interface TopProductsProps {
  products: TopProduct[];
}

export function TopProducts({ products }: TopProductsProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Package className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <div className="text-sm font-medium">No product data available</div>
        <div className="text-xs">Product performance will appear here once you have sales</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product, index) => (
        <div key={product.product?.id || index} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-lg">
              <Package className="h-4 w-4 text-orange-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 truncate">
                  {product.product?.name || "Unknown Product"}
                </span>
                {index < 3 && (
                  <Badge variant="secondary" className="text-xs">
                    #{index + 1}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{product.totalSold || 0} units sold</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {product.totalRevenue?.toLocaleString() || "0"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600 font-medium">
              +{Math.floor(Math.random() * 20) + 5}%
            </span>
          </div>
        </div>
      ))}
      
      <div className="pt-4 border-t border-slate-200">
        <Link href="/product">
          <Button variant="outline" size="sm" className="w-full">
            View All Products
            <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
