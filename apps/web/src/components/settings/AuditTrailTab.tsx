import useSWR from "swr";
import { format } from "date-fns";
import { Activity, History, RefreshCw, User } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { fetcher } from "../../lib/api";

interface AuditLogRow {
  id: string;
  organizationId: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface AuditResponse {
  logs: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}

function actionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  switch (action.toUpperCase()) {
    case "CREATE":
      return "default";
    case "UPDATE":
      return "secondary";
    case "DELETE":
    case "CANCEL":
      return "destructive";
    default:
      return "outline";
  }
}

export function AuditTrailTab() {
  const { data, error, isLoading, mutate } = useSWR<AuditResponse>(
    "/audit?limit=50",
    fetcher
  );

  const logs = data?.logs ?? [];

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="size-5 text-primary" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            System-wide log of operations, document cancellations, and setting changes
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="py-8 text-center text-xs text-destructive">
            Could not load audit log history.
          </div>
        ) : isLoading && logs.length === 0 ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <Activity className="size-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No audit entries recorded yet</p>
            <p className="text-xs">
              Actions like cancelling invoices, updating company profiles, or modifying settings will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-xs w-40">Date & Time</TableHead>
                  <TableHead className="font-semibold text-xs w-32">Action</TableHead>
                  <TableHead className="font-semibold text-xs w-44">Target Entity</TableHead>
                  <TableHead className="font-semibold text-xs">Operator</TableHead>
                  <TableHead className="font-semibold text-xs">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  let formattedDate = log.createdAt;
                  try {
                    formattedDate = format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss");
                  } catch {}

                  return (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="font-mono text-muted-foreground">
                        {formattedDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionBadgeVariant(log.action)} className="text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <span className="text-muted-foreground text-[11px]">{log.entityType}: </span>
                        {log.entityId}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div className="flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">{log.user.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">System</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground font-mono text-[11px]">
                        {log.details || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
