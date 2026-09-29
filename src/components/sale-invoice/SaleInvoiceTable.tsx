"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Search, Eye, Ellipsis } from "lucide-react";
import { format } from "date-fns";
import SaleInvoiceActionButton from "../invoices/SaleInvoiceAcBtn";
import type { fetchSalesInvoices } from "@/actions/saleInvoice";

type SaleInvoiceRow = NonNullable<
  Awaited<ReturnType<typeof fetchSalesInvoices>>["data"]
>[number];

export default function SaleInvoiceTable({
  saleInvoice,
}: {
  saleInvoice?: SaleInvoiceRow[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = saleInvoice?.filter(
    (sale) =>
      sale.saleCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>CreateAt</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSales?.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell className="font-medium">{sale.saleCode}</TableCell>
              <TableCell>{sale.customer.name}</TableCell>
              <TableCell>{sale.items.length} items</TableCell>
              <TableCell>${sale.totalAmount.toFixed(2)}</TableCell>
              <TableCell>${sale.taxAmount?.toFixed(2) || "0.00"}</TableCell>
              <TableCell>${sale.discount?.toFixed(2) || "0.00"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    sale.status === "Completed"
                      ? "default"
                      : sale.status === "Pending"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {sale.status}
                </Badge>
              </TableCell>
              <TableCell>{sale.saleDate.toLocaleDateString()}</TableCell>
              <TableCell>
                {format(new Date(sale.createdAt), "dd-MMM-yyyy,h:mm a")}
              </TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button size="sm" variant="outline" title="Actions">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[160px]">
                    <DropdownMenuItem asChild>
                      <SaleInvoiceActionButton
                        saleCode={sale.saleCode}
                        size="sm"
                        variant="outline"
                        title="Download"
                        action="download"
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <SaleInvoiceActionButton
                        saleCode={sale.saleCode}
                        size="sm"
                        variant="outline"
                        title="Print"
                        action="print"
                      />
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      {" "}
                      <Button size="sm" variant="outline" title="View Details">
                        <Eye className="h-4 w-4" />
                        <span className="capitalize">View</span>
                      </Button>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href={`/sales/${sale.id}/edit`}>
                        <Button size="sm" variant="outline" title="Edit">
                          <Edit className="h-4 w-4" />
                          <span className="capitalize">Edit</span>
                        </Button>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Button
                        size="sm"
                        variant="outline"
                        // onClick={() => handleDelete(sale.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="capitalize">Delete</span>
                      </Button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
