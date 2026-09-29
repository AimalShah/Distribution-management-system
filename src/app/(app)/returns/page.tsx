
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
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  RotateCcw,
  AlertCircle,
  Package,
} from "lucide-react";
import Link from "next/link";
import { ReturnType } from "@/types/return";
import { format } from "date-fns";
import { fetchReturns } from "@/actions/return";

export default async function ReturnsPage() {
  
  const data = await fetchReturns();
  const returns = data?.data;
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
      case "Completed":
        return (
          <Badge variant="default" className="bg-green-500">
            {status}
          </Badge>
        );
      case "Rejected":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReturnTypeBadge = (returnType: ReturnType | undefined) => {
    switch (returnType) {
      case "SALE":
        return (
          <Badge variant="outline" className=" flex items-center gap-1 text-yellow-600 border-yellow-200">
            <RotateCcw className="h-3 w-3" />
            Sale Return
          </Badge>
        );
      case "PURCHASE":
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
            <RotateCcw className="h-3 w-3" />
            Purchase Return
          </Badge>
        );
      case "DAMAGED":
        return (
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-red-600 border-red-200"
          >
            <Package className="h-3 w-3" />
            Damaged
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge
            variant="outline"
            className="flex items-center gap-1 text-orange-600 border-orange-200"
          >
            <AlertCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{returnType}</Badge>;
    }
  };
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Returns Management
        </h2>
        <Link href="/returns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Return
          </Button>
        </Link>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search returns..." className="pl-8" />
        </div>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>CreatedAt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns?.map((returnItem) => (
                <TableRow key={returnItem.id}>
                  <TableCell className="font-medium">
                    {returnItem.returnCode}
                  </TableCell>
                  <TableCell>
                    {getReturnTypeBadge(returnItem?.returnType)}
                  </TableCell>
                  <TableCell>{returnItem.user?.name}</TableCell>

                  <TableCell>
                    {format(new Date(returnItem.returnDate), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {returnItem.reason || "No reason provided"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {returnItem.items.length} item
                      {returnItem.items.length !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {returnItem.items[0]?.product?.name}
                      {returnItem.items.length > 1 &&
                        ` +${returnItem.items.length - 1} more`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(returnItem?.createdAt),
                      "dd MMM yyyy, hh:mm a"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
