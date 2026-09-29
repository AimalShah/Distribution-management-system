
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, ArrowLeft } from "lucide-react";

import Link from "next/link";
import ReturnForm from "@/components/returns/ReturnForm";
import { fetchProducts } from "@/actions/product";
import { fetchCustomers } from "@/actions/customer";
import { fetchPurchases } from "@/actions/purchase";

export default async function NewReturnPage() {
  const productsData = await fetchProducts();
  const customersData = await fetchCustomers();
  const purchaseData = await fetchPurchases();
  const productsList = productsData?.data;
  const customersList = customersData?.data;
  const purchaseList = purchaseData?.data;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/returns">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Returns
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <Badge variant="secondary" className="gap-1.5">
              <RotateCcw className="h-3 w-3" />
              New Return
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Create New Return
            </h1>
            <p className="text-slate-600 mt-1">
              Process returns for sales, purchases, or inventory adjustments
            </p>
          </div>
        </div>

        <ReturnForm
          products={productsList}
          customers={customersList}
          purchases={purchaseList}
        />
      </div>
    </div>
  );
}
