import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@dms/ui";
import { cn } from "@dms/ui";
import { fetcher } from "../../lib/api";
import { formatMoney } from "../../lib/format";

export interface PickerProduct {
  id: string;
  name: string;
  productCode: string;
  unitPrice: number;
  unitCost?: number;
  unit?: string;
  gstApplicable?: boolean;
  gstRate?: number;
  inventory?: { quantityOnHand: number } | null;
}

interface ProductSearchSelectProps {
  value: string;
  onChange: (value: string, product?: PickerProduct) => void;
  disabled?: boolean;
  "aria-label"?: string;
  priceMode?: "sale" | "purchase";
}

/**
 * A searchable product field for invoice lines: type two letters, pick the
 * product, and see its stock before choosing it — without leaving the table.
 * Replaces the "first 100 products" dropdown, which silently hid everything
 * after that.
 */
export function ProductSearchSelect({
  value,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  priceMode = "sale",
}: ProductSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useSWR(
    open
      ? `/products?search=${encodeURIComponent(debounced)}&pageSize=10&isActive=true`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const results: PickerProduct[] = data?.data ?? [];

  // The currently chosen product must stay visible when the field is closed:
  // the search results open on whatever the user types next, so what was picked
  // is fetched once, on demand, and merged into the list.
  const { data: chosen } = useSWR(value ? `/products/${value}` : null, fetcher);
  // SAFETY: The /products/:id endpoint returns either the product record or 404.
  const chosenProduct = chosen as PickerProduct | undefined;

  const displayed = useMemo(() => {
    const list = [...results];

    if (value && chosenProduct && !list.some((p) => p.id === value)) {
      list.unshift(chosenProduct);
    }

    return list;
  }, [results, chosenProduct, value]);

  const selected = displayed.find((p) => p.id === value);

  const handleSelect = (product: PickerProduct) => {
    onChange(product.id, product);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-9 w-full items-center justify-between gap-2 truncate rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.name} (${selected.productCode})`
              : "Search product…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <div className="relative border-b">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            className="flex h-9 w-full bg-transparent px-8 py-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {debounced.length > 0 && results.length === 0 && !isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No product matches “{debounced}”.
            </p>
          )}
          {debounced.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Start typing to search every product, not just the first 100.
            </p>
          )}
          {displayed.map((product) => {
            const stock = product.inventory?.quantityOnHand ?? 0;

            return (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={product.id === value}
                className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted aria-selected:bg-muted"
                onClick={() => handleSelect(product)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="flex items-center gap-2 font-medium leading-snug">
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      product.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{product.name}</span>
                  <span className="ml-auto shrink-0 text-xs font-mono text-muted-foreground">
                    {product.productCode}
                  </span>
                </span>
                <span className="flex items-center gap-3 pl-5 text-xs text-muted-foreground">
                  <span>
                    In stock:{" "}
                    <strong
                      className={
                        stock > 0 ? "text-foreground" : "text-destructive"
                      }
                    >
                      {stock}
                    </strong>
                  </span>
                  <span>
                    {priceMode === "purchase" ? "Cost: " : "Price: "}
                    <strong className="text-foreground">
                      {formatMoney(
                        priceMode === "purchase"
                          ? (product.unitCost ?? 0)
                          : product.unitPrice
                      )}
                    </strong>
                  </span>
                  {stock === 0 && (
                    <span className="text-destructive">Out of stock</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
