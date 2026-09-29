import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Plus } from "lucide-react";
import { fetchSalesInvoices } from "@/actions/saleInvoice";
import SaleInvoiceTable from "@/components/sale-invoice/SaleInvoiceTable";

export default async function SalesPage() {
  const saleInvoiceData = await fetchSalesInvoices();
  const saleInvoice = saleInvoiceData?.data;
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales</CardTitle>
              <CardDescription>
                Manage sales orders and transactions
              </CardDescription>
            </div>
            <Link href="/sale-invoice/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Sale
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <SaleInvoiceTable saleInvoice={saleInvoice} />
        </CardContent>
      </Card>
    </div>
  );
}
