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

export function ListTablePanel({ search, filters, isLoading, isEmpty, skeleton, table, empty }: ListTablePanelProps) {
  return (
    <div className="card p-0 overflow-hidden">
      {(search || filters) && (
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          {search && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={search.placeholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg bg-background"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {filters && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-1">
                <Filter className="size-3.5" />
                <span>Filters:</span>
              </div>
            )}
            {filters}
          </div>
        </div>
      )}
      <div className="p-4 sm:p-5">
        {isLoading ? skeleton : !isEmpty ? table : empty}
      </div>
    </div>
  );
}
