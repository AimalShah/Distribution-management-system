import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, Skeleton } from "@dms/ui";
import { api } from "../lib/api";
import { PurchaseForm } from "../components/purchases/PurchaseForm";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function PurchaseEdit() {
  const { id } = useParams<{ id: string }>();

  const { data: purchase, error, isLoading } = useSWR(
    id ? `/purchases/${id}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Purchase order not found</AlertTitle>
          <AlertDescription>
            The purchase order you are trying to edit could not be loaded or does not exist.
          </AlertDescription>
        </Alert>
        <div>
          <Link to="/purchases">
            <Button variant="outline">
              <ArrowLeft className="size-4 mr-2" />
              Back to Purchases
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto w-full animate-slideInUp">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link to="/" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/purchases" className="hover:text-primary transition-colors">
            Purchases
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Edit Order</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Purchase Order</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Update status and adjustments for <span className="font-semibold text-foreground">{purchase.purchaseCode}</span>
        </p>
      </div>

      <PurchaseForm isEditing purchaseId={id} initialData={purchase} />
    </div>
  );
}
