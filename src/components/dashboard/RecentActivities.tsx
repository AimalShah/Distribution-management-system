"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShoppingCart, 
  DollarSign, 
  Package, 
  ArrowUpRight,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

type SaleInvoice = {
  id: string;
  saleCode: string;
  saleDate: Date;
  createdAt: Date;
  totalAmount: number;
  customer: { name: string } | null;
};

type Purchase = {
  id: string;
  purchaseCode: string;
  purchaseDate: Date;
  createdAt: Date;
  totalAmount: number;
  supplier: { companyName: string } | null;
};

interface RecentActivitiesProps {
  sales: SaleInvoice[];
  purchases: Purchase[];
}

export function RecentActivities({ sales, purchases }: RecentActivitiesProps) {
  const activities = [
    ...sales.map((sale) => ({
      ...sale,
      type: "sale" as const,
      date: new Date(sale.saleDate || sale.createdAt),
      amount: sale.totalAmount,
      code: sale.saleCode,
      customer: sale.customer?.name || "Unknown Customer",
    })),
    ...purchases.map((purchase) => ({
      ...purchase,
      type: "purchase" as const,
      date: new Date(purchase.purchaseDate || purchase.createdAt),
      amount: purchase.totalAmount,
      code: purchase.purchaseCode,
      supplier: purchase.supplier?.companyName || "Unknown Supplier",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Package className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <div className="text-sm font-medium">No recent activities</div>
        <div className="text-xs">Activities will appear here once you have transactions</div>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "sale":
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case "purchase":
        return <ShoppingCart className="h-4 w-4 text-blue-600" />;
      default:
        return <Package className="h-4 w-4 text-slate-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "sale":
        return "bg-green-50 text-green-700 border-green-200";
      case "purchase":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={`${activity.type}-${activity.id || index}`} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
          <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {activity.type === "sale" ? activity.customer : activity.supplier}
                </span>
                <Badge variant="outline" className="text-xs">
                  {activity.type === "sale" ? "Sale" : "Purchase"}
                </Badge>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                ${activity.amount?.toLocaleString() || "0"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                {format(activity.date, "MMM dd, yyyy")}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {activity.code}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      <div className="pt-4 border-t border-slate-200">
        <Link href={activities.some(a => a.type === "sale") ? "/sale-invoice" : "/purchase"}>
          <Button variant="outline" size="sm" className="w-full">
            View All Activities
            <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
