"use client";

import { AlertTriangle, Package, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { InventoryForms } from "./AddInventoryForm";

interface inventoryTableProps {
  products: {
    id: string;
    name: string;
    sku: string;
    category: string;
    supplierId: string;
    stock: number;
    minStock: number;
    price: number;
  }[];
  suppliers: { id: string; name: string }[];
}

export default function InventoryTable({
  products,
  suppliers,
}: inventoryTableProps) {
  const [openProductForm, setOpenProductForm] = useState(false);



  const getSupplierName = (supplierId: string) => {
    return suppliers.find((s) => s.id === supplierId)?.name || "Unknown";
  };

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock <= minStock)
      return { label: "Low Stock", color: "bg-red-100 text-red-800" };
    if (stock <= minStock * 2)
      return { label: "Medium", color: "bg-yellow-100 text-yellow-800" };
    return { label: "In Stock", color: "bg-green-100 text-green-800" };
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Inventory Management
            </h2>
            <p className="text-muted-foreground">
              Manage your product inventory and stock levels
            </p>
          </div>
         
          <Button onClick={() => setOpenProductForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
         
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-8" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Inventory
            </CardTitle>
            <CardDescription>
              Overview of all products in your inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stockStatus = getStockStatus(
                    product.stock,
                    product.minStock
                  );
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.stock <= product.minStock && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        {getSupplierName(product.supplierId)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{product.stock} units</div>
                          <div className="text-muted-foreground">
                            Min: {product.minStock}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={stockStatus.color}>
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      {openProductForm && (
        <InventoryForms
          isOpen={openProductForm}
          onClose={() => setOpenProductForm(false)}
        />
      )}
    </div>
  );
}
