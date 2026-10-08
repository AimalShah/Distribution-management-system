import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, Skeleton } from "@dms/ui";
import { fetcher } from "../lib/api";
import { ProductForm } from "../components/products/ProductForm";

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();

  const { data: product, error, isLoading } = useSWR(
    id ? `/products/${id}` : null,
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

  if (error || !product) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Product not found</AlertTitle>
          <AlertDescription>
            The product you are trying to edit could not be loaded or does not exist.
          </AlertDescription>
        </Alert>
        <div>
          <Link to="/products">
            <Button variant="outline">
              <ArrowLeft className="size-4 mr-2" />
              Back to Products
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
          <Link to="/products" className="hover:text-primary transition-colors">
            Products
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Edit Product</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Product</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Update product details, pricing, and status for <span className="font-semibold text-foreground">{product.name}</span>.
        </p>
      </div>

      <ProductForm isEditing productId={id} initialData={product} />
    </div>
  );
}
