import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@dms/ui";

/** Debounced so typing a name is one request, not one per keystroke. */
export function SearchInput({
  onSearch,
  placeholder = "Search...",
  delay = 300,
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), delay);
    return () => clearTimeout(timer);
    // `onSearch` is a fresh closure every render; the value is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-8"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}
