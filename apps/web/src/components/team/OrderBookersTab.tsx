import { useState } from "react";
import useSWR from "swr";
import { Edit2, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dms/ui";
import { api, failureMessage, fetcher } from "../../lib/api";
import { OrderBookerDialog, type OrderBookerRecord } from "./OrderBookerDialog";

export function OrderBookersTab() {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrderBookerRecord | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (search.trim()) {
    queryParams.set("search", search.trim());
  }
  if (!showInactive) {
    queryParams.set("isActive", "true");
  }

  const queryStr = queryParams.toString();
  const endpoint = `/order-bookers${queryStr ? `?${queryStr}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher);

  const bookers: OrderBookerRecord[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];

  const handleCreateOrUpdate = async (input: {
    code: string;
    name: string;
    phone?: string;
    isActive?: boolean;
  }) => {
    if (editing) {
      await api.patch(`/order-bookers/${editing.id}`, input);
      toast.success("Order Booker updated");
    } else {
      await api.post("/order-bookers", input);
      toast.success("Order Booker created");
    }
    await mutate();
  };

  const handleToggleStatus = async (booker: OrderBookerRecord) => {
    setActionBusy(booker.id);
    try {
      const nextStatus = !booker.isActive;
      await api.patch(`/order-bookers/${booker.id}`, { isActive: nextStatus });
      toast.success(
        nextStatus ? "Order Booker reactivated" : "Order Booker deactivated"
      );
      await mutate();
    } catch (err: unknown) {
      toast.error(failureMessage(err, "Failed to update status"));
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive-bookers"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <label
              htmlFor="show-inactive-bookers"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Show inactive
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Add Order Booker
          </Button>
        </div>
      </div>

      <Card className="rounded-md border border-border shadow-none">
        <CardContent className="pt-6">
          {error ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 py-10 text-center"
            >
              <p className="text-sm font-medium">Could not load Order Bookers</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {failureMessage(error, "The request failed. Try again.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : isLoading && bookers.length === 0 ? (
            <div role="status" aria-label="Loading order bookers" className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : bookers.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <UserCheck className="size-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No order bookers found</p>
              <p className="text-xs mt-0.5">
                Add field booking agents to attribute customer bookings.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-xs">Code</TableHead>
                    <TableHead className="font-semibold text-xs">Name</TableHead>
                    <TableHead className="font-semibold text-xs">Phone</TableHead>
                    <TableHead className="font-semibold text-xs">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookers.map((booker) => (
                    <TableRow key={booker.id} className="text-xs">
                      <TableCell className="font-mono font-medium">
                        {booker.code}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {booker.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {booker.phone || "—"}
                      </TableCell>
                      <TableCell>
                        {booker.isActive ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              setEditing(booker);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit2 className="size-3" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleToggleStatus(booker)}
                            disabled={actionBusy === booker.id}
                          >
                            {booker.isActive ? (
                              <>
                                <ShieldOff className="size-3" aria-hidden="true" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="size-3" aria-hidden="true" />
                                Reactivate
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderBookerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        booker={editing}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
}
