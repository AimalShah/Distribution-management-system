import { Link } from "react-router-dom";
import { ProductForm } from "../components/products/ProductForm";

export default function ProductNew() {
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
          <span className="text-foreground font-semibold">New Product</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Product</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Create a new product in your catalog with pricing, category, and SKU.
        </p>
      </div>

      <ProductForm />
    </div>
  );
}
