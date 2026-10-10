import * as React from "react";
import { Filter, Search, X } from "lucide-react";
import { Input } from "@dms/ui";

export interface ListTablePanelProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  skeleton: React.ReactNode;
  table: React.ReactNode;
  empty: React.ReactNode;
}

export function ListTablePanel({
  search,
  filters,
  actions,
  isLoading,
  isEmpty,
  skeleton,
  table,
  empty,
}: ListTablePanelProps) {
  return (
    <div className="card p-0 overflow-hidden border border-border shadow-sm">
      {(search || filters || actions) && (
        <div className="p-2.5 sm:px-4 sm:py-2 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/20">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2">
            {search && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder={search.placeholder}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs rounded-md bg-background focus-visible:ring-1"
                />
                {search.value && (
                  <button
                    type="button"
                    onClick={() => search.onChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
            {filters && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
                  <Filter className="size-3.5" />
                  <span>Filters:</span>
                </div>
                {filters}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-4">{skeleton}</div>
        ) : !isEmpty ? (
          table
        ) : (
          <div className="p-8 text-center">{empty}</div>
        )}
      </div>
    </div>
  );
}

export default ListTablePanel;
