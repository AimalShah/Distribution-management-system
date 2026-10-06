import { Link } from "react-router-dom";
import { SaleInvoiceForm } from "../components/sales/SaleInvoiceForm";

export default function SaleInvoiceNew() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto w-full animate-slideInUp">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link to="/" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/sales" className="hover:text-primary transition-colors">
            Sales
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">New Invoice</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Sale Invoice</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Create a sales invoice for a customer with products, quantities, and pricing
        </p>
      </div>

      <SaleInvoiceForm />
    </div>
  );
}
