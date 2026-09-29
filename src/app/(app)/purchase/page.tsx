import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fetchPurchases } from "@/actions/purchase";

export default async  function PurchasesPage() {
  const data = await fetchPurchases();
  const purchases = data?.data;


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge variant="secondary">{status}</Badge>;
      case "Approved":
        return (
          <Badge variant="default" className="bg-blue-500">
            {status}
          </Badge>
        );
      case "Received":
        return (
          <Badge variant="default" className="bg-green-500">
            {status}
          </Badge>
        );
      case "Cancelled":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Purchase Orders</h2>
        <Link href="/purchase/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search purchase orders..." className="pl-8" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!purchases ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No purchase orders found.
                  </TableCell>
                </TableRow>
              ) : (
                purchases?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.purchaseCode}
                    </TableCell>
                    <TableCell>{order.supplier.companyName}</TableCell>
                    <TableCell>
                      {new Date(order.purchaseDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{order.purchaseItems.length}</TableCell>
                    {order.purchaseItems.reduce(
                      (sum, p) => sum + p.totalCost,
                      0
                    )}

                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      {format(new Date(order.createdAt), "h:mm a")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
