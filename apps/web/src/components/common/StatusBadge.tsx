import { Badge } from "@dms/ui";

/** Document status (purchase, sale, return) as a badge. */
export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "Completed" ? "default" : status === "Cancelled" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
