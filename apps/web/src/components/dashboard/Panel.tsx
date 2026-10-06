import type { ReactNode } from "react";
import {
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
 * action, plus the two states a remote card can be in before its data lands.
 *
 * Loading and empty are handled here rather than in each panel because six
 * panels getting that wrong in six different ways is how a dashboard ends up
 * with a blank rectangle where a chart should be. `skeletonHeight` exists
 * because a 48px placeholder suits a list of rows and not a 300px chart.
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
  empty?: boolean;
  emptyMessage?: string;
  skeletonHeight?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
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
