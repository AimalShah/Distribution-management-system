import { Link, useLocation } from "react-router-dom";
import { Compass, LayoutDashboard } from "lucide-react";
import { Button, Card, CardContent } from "@dms/ui";

/**
 * The catch-all route (issue #40).
 *
 * Without it the router matches no path, `<Outlet>` renders nothing, and the
 * user gets a blank white screen with no clue that the address was wrong. This
 * page says what happened and offers the two ways out: back to the dashboard,
 * or correct the address in the bar.
 *
 * The path is shown because the commonest cause is a stale link — a sidebar
 * entry or a bookmark pointing at a route that was renamed or never wired up.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60svh] items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-md border border-border shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Compass className="size-6 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">Page not found</h1>
            <p className="text-sm text-muted-foreground">
              Nothing is served at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {pathname}
              </code>
              . The link may be out of date, or the address may have a typo.
            </p>
          </div>

          <Button asChild size="sm" className="gap-1.5">
            <Link to="/">
              <LayoutDashboard className="size-3.5" aria-hidden="true" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}