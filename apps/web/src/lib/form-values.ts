/**
 * react-hook-form `setValueAs` for numeric inputs: blank is `undefined` (so an
 * optional schema field stays unset) and anything else is a number (so the
 * request body carries `12.5`, not `"12.5"` -- the purchase and sale schemas
 * validate `z.number()`, not a coerced string).
 */
export const asNumber = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : Number(value);

/** A random document code in the legacy shape (`PO-7K2QX`). Editable in the form. */
export function generateCode(prefix: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Today as `YYYY-MM-DD`, the value an `<input type="date">` holds. */
export const todayInput = () => new Date().toISOString().slice(0, 10);

/** An ISO timestamp as an `<input type="date">` value. */
export const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
