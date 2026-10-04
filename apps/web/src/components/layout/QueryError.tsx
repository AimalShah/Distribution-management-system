import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@dms/ui";
import { errorMessage } from "../../lib/fetcher";

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Could not load this data</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{errorMessage(error)}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
