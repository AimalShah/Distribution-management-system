"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Package,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The rows this table renders: a product plus the two relations it displays.
 * Anything else the product query returns (inventory, logs, …) is ignored.
 */
export interface ProductTableRow {
  id: string;
  name: string;
  productCode: string;
  unitPrice: number;
  isActive: boolean;
  brand?: { name: string } | null;
  category?: { name: string } | null;
}

export default function ProductTable({
  products,
}: {
  products: ProductTableRow[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const router = useRouter();

  const filteredProducts = products?.filter((product) => {
    const name = product.name?.toLowerCase() || "";
    const code = product.productCode?.toLowerCase() || "";
    const brand = product.brand?.name?.toLowerCase() || "";

    const matchesSearch =
      name.includes(searchTerm.toLowerCase()) ||
      code.includes(searchTerm.toLowerCase()) ||
      brand.includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.isActive) ||
      (statusFilter === "inactive" && !product.isActive);

    const matchesCategory =
      categoryFilter === "all" || product.category?.name === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });
  const categories: string[] = [
    ...new Set(
      (products || [])
        .map((p) => p.category?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];
  const totalProducts = products?.length;

  const handleEditProduct = (productId: string) => {
    router.push(`/product/edit/${productId}`);
  };

  const handleViewProduct = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  const handleDeleteProduct = (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      console.log("Delete product:", productId);
    }
  };
  return (
    <div>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 font-medium">
                  Filters:
                </span>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] border-gray-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px] border-gray-200">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-gray-600">
              Showing{" "}
              <span className="font-medium">
                {filteredProducts?.length || 0}
              </span>{" "}
              of <span className="font-medium">{totalProducts}</span> products
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-900">
                      Product Name
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Code
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Brand
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Category
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Price
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[100px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="hover:bg-gray-50/50 transition-colors border-gray-100"
                    >
                      <TableCell className="font-medium text-gray-900">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-gray-600 font-mono text-sm">
                        {product.productCode}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {product.brand?.name || "-"}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {product.category?.name || "-"}
                      </TableCell>
                      <TableCell className="text-gray-900 font-semibold">
                        Rs. {product.unitPrice?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className={
                            product.isActive
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[160px]"
                          >
                            <DropdownMenuItem
                              onClick={() => handleViewProduct(product.id)}
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditProduct(product.id)}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteProduct(product.id)}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ||
                statusFilter !== "all" ||
                categoryFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first product"}
              </p>
              {!searchTerm &&
                statusFilter === "all" &&
                categoryFilter === "all" && (
                  <Button
                    onClick={() => router.push("/product/new")}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
