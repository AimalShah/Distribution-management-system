import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@dms/ui";
import { failureMessage } from "../../lib/api";

interface LoadErrorStateProps {
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
}

export function LoadErrorState({ error, onRetry, compact = false }: LoadErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center ${compact ? "gap-2 py-5" : "gap-3 py-12"}`}
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Couldn’t load this data</h3>
        <p className="max-w-lg text-xs text-muted-foreground">
          {failureMessage(error, "The request failed. Check your connection and try again.")}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
