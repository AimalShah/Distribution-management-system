import { Link } from "react-router-dom";
import { Button } from "@dms/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-muted-foreground">There is nothing at this address.</p>
      <Button asChild variant="outline">
        <Link to="/dashboard">Back to the dashboard</Link>
      </Button>
    </div>
  );
}
