import * as React from "react";
import { Filter, Search } from "lucide-react";
import { Input } from "@dms/ui";

export interface ListTablePanelProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  filters?: React.ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  skeleton: React.ReactNode;
  table: React.ReactNode;
  empty: React.ReactNode;
}

// ListTablePanel kept as-is for existing callers
// (DataTable + search + filter + pagination)
export function ListTablePanel({ search, filters, isLoading, isEmpty, skeleton, table, empty }: ListTablePanelProps) {
  return (
    <div className="card p-0 overflow-hidden">
      {(search || filters) && (
        <div className="p-3 sm:px-4 sm:py-2.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/30">
          {search && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={search.placeholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="pl-8 h-8 text-xs rounded-md bg-background"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {filters && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
                <Filter className="size-3.5" />
                <span>Filters:</span>
              </div>
            )}
            {filters}
          </div>
        </div>
      )}
      <div className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-4">{skeleton}</div>
        ) : !isEmpty ? (
          table
        ) : (
          <div className="p-6 text-center">{empty}</div>
        )}
      </div>
    </div>
  );
}
