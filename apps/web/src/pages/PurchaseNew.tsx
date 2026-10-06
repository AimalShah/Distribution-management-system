import { Link } from "react-router-dom";
import { PurchaseForm } from "../components/purchases/PurchaseForm";

export default function PurchaseNew() {
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
          <span className="text-foreground font-semibold">New Order</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Purchase Order</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Create a purchase order from a supplier with items, pricing, and batch details
        </p>
      </div>

      <PurchaseForm />
    </div>
  );
}
