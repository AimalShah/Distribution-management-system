import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities winning conflicts.
 *
 * `clsx` handles conditionals and arrays; `tailwind-merge` then resolves the
 * fact that `px-2` and `px-4` are the same property rather than two separate
 * classes the browser would resolve by stylesheet order. Every component in
 * this package takes a `className` and calls this, so a caller can always
 * override a component's own styling without `!important`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
