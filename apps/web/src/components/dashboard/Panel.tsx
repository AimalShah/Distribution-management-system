import type { ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  cn,
} from "@dms/ui";

/**
 * The frame every dashboard card sits in: title, optional description and
 * action, plus the three states a remote card can be in — loading, failed,
 * and confirmed-empty — before its data lands.
 *
 * Loading, error and empty are handled here rather than in each panel because
 * six panels getting that wrong in six different ways is how a dashboard ends
 * up with a blank rectangle where a chart should be, or worse, a green
 * "all good" message over a request that silently failed. An error must never
 * be mistaken for an empty result, so `error` takes priority over `empty`.
 * `skeletonHeight` exists because a 48px placeholder suits a list of rows and
 * not a 300px chart.
 *
 * The card's own `py-6`/`gap-6` supply the vertical rhythm, so this only has
 * to shape the header row — no `border-b`, which the reference's cards do not
 * have either.
 */
export function Panel({
  title,
  description,
  action,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyMessage = "Nothing to show yet",
  skeletonHeight = "h-48",
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  skeletonHeight?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("rounded-md border border-border shadow-none", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <Skeleton className={cn("w-full", skeletonHeight)} />
        ) : error ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center"
          >
            <TriangleAlert className="size-5 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Couldn&apos;t load this panel</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            ) : null}
          </div>
        ) : empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
