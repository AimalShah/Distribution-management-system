import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
  /** Shown in place of the rows when `data` is empty. */
  emptyMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  pageCount,
  pageIndex,
  pageSize,
  onPaginationChange,
  emptyMessage = "No results.",
}: DataTableProps<TData>) {
  // An empty result is still one page; "Page 1 of 0" reads as a bug.
  const pages = Math.max(pageCount, 1);
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

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => (
                  <th key={h.id} className="p-2 text-left">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={pageIndex === 0}
          onClick={() => onPaginationChange(pageIndex - 1, pageSize)}
        >
          Previous
        </button>
        <span className="text-sm">Page {pageIndex + 1} of {pages}</span>
        <button
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={pageIndex + 1 >= pages}
          onClick={() => onPaginationChange(pageIndex + 1, pageSize)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
