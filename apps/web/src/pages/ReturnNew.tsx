import { Link } from "react-router-dom";
import { ReturnForm } from "../components/returns/ReturnForm";

export default function ReturnNew() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto w-full animate-slideInUp">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link to="/" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/returns" className="hover:text-primary transition-colors">
            Returns
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">New Return</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Return</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Process customer returns, vendor purchase reversals, or damaged/expired stock write-offs
        </p>
      </div>

      <ReturnForm />
    </div>
  );
}
