import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@dms/ui";

/**
 * A native `<select>` styled like `Input`. Used in forms over the Radix
 * `Select` because it registers with react-hook-form like any input, works
 * with the keyboard and screen readers without configuration, and can be
 * driven in tests by its label.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";
