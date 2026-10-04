import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, Skeleton } from "@dms/ui";
import { QueryError } from "../layout/QueryError";
import { PAGE_SIZE, type Paginated } from "../../hooks/use-paginated";

interface ResourceTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  result: {
    data?: Paginated<T>;
    error?: unknown;
    mutate: () => unknown;
    page: number;
    setPage: (page: number) => void;
  };
  emptyMessage: string;
}

/** A list endpoint as a table: skeleton, then rows or an error with retry. */
export function ResourceTable<T>({ columns, result, emptyMessage }: ResourceTableProps<T>) {
  if (result.error) return <QueryError error={result.error} onRetry={() => result.mutate()} />;
  if (!result.data) {
    return (
      <div className="space-y-2" data-testid="table-skeleton" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={result.data.data}
      pageCount={result.data.pageCount}
      pageIndex={result.page - 1}
      pageSize={PAGE_SIZE}
      onPaginationChange={(pageIndex) => result.setPage(pageIndex + 1)}
      emptyMessage={emptyMessage}
    />
  );
}
