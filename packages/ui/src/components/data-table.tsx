import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./table";
import { Button } from "./button";

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  density?: "compact" | "default";
  emptyMessage?: string;
  hidePagination?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  pageCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  density = "compact",
  emptyMessage = "No records found.",
  hidePagination = false,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination: { pageIndex, pageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function"
        ? updater({ pageIndex, pageSize })
        : updater;

      onPaginationChange(next.pageIndex, next.pageSize);
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const isCompact = density === "compact";

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as { headerClassName?: string } | undefined;
                  return (
                    <TableHead
                      key={h.id}
                      compact={isCompact}
                      className={meta?.headerClassName}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { cellClassName?: string } | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        compact={isCompact}
                        className={meta?.cellClassName}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground text-xs"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!hidePagination && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <div>
            Page <span className="font-medium text-foreground">{pageIndex + 1}</span> of{" "}
            <span className="font-medium text-foreground">{Math.max(1, pageCount)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              disabled={pageIndex === 0}
              onClick={() => onPaginationChange(pageIndex - 1, pageSize)}
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              disabled={pageIndex + 1 >= pageCount}
              onClick={() => onPaginationChange(pageIndex + 1, pageSize)}
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
