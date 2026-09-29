
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SaleInvoiceForm from "@/components/sale-invoice/SaleInvoiceForm";
import { fetchProducts } from "@/actions/product";
import { fetchCustomers } from "@/actions/customer";

export default async function NewSalePage() {
  const productData = await fetchProducts();
  const customersData = await fetchCustomers();
  const products = productData?.data;
  const customers = customersData?.data;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/sales">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Sales
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <Badge variant="secondary" className="gap-1.5">
              <Receipt className="h-3 w-3" />
              New Invoice
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Create Sale Invoice
            </h1>
            <p className="text-slate-600 mt-1">
              Generate a new sale invoice for your customer with detailed line
              items
            </p>
          </div>
        </div>

        <SaleInvoiceForm customers={customers} products={products} />
      </div>
    </div>
  );
}
