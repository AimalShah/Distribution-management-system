import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@dms/ui";
import { PageHead } from "../components/list/PageHead";
import { Batches } from "./inventory/Batches";

/**
 * Stock batches as a page of their own (issue #40).
 *
 * The sidebar's "Batches" entry has pointed at `/inventory/batches` since the
 * lot work landed, but the view only ever existed as a tab inside the
 * Inventory page, so the link matched no route and rendered a blank screen. The
 * list itself is unchanged and still reachable as the Inventory page's tab;
 * this is the same component given an address.
 */
export default function BatchesPage() {
  return (
    <div>
      <PageHead
        title="Batches & Expiry Dates"
        subtitle="Received stock tracked by batch, with expiry state and first-expiry-first-out allocation"
        breadcrumb={
          <>
            <Link to="/inventory" className="hover:text-stone-600 transition-colors">
              Stock Adjustments
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-stone-600">Batches</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/inventory">
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              Stock Adjustments
            </Link>
          </Button>
        }
      />

      <Batches />
    </div>
  );
}