/**
 * SKU generation (ADR 0007).
 *
 * A product's `productCode` *is* its SKU: the server builds it from a per-Company
 * format of tokens, and it never changes once assigned. The format is composed of
 * tokens joined by the Company's separator, for example `{BRAND}-{CATEGORY}-{SEQ:5}`.
 *
 * The generator lives in `@dms/shared` rather than on the server so the Settings
 * page's live preview runs the *same* code the write path will, instead of a
 * second implementation that drifts.
 */

export const SKU_TOKENS = [
  "BRAND",
  "CATEGORY",
  "NAME",
  "SEQ",
  "YYYY",
  "YY",
  "MM",
  "RANDOM",
] as const;

export type SkuToken = (typeof SKU_TOKENS)[number];

const TOKEN_PATTERN = /\{([A-Z]+)(?::(\d+))?\}/g;

/** The pieces a format can expand from, already resolved to plain strings. */
export interface SkuContext {
  /** The brand's short code, falling back to its name when blank. */
  brand?: string | null;
  /** The category's short code, falling back to its name when blank. */
  category?: string | null;
  /** The product's name. */
  name?: string | null;
  /** The per-Company sequence value; never resets. */
  sequence?: number;
  /** The date the SKU is being made, for the date tokens. */
  date?: Date;
  /** Injectable so tests are deterministic; defaults to `Math.random`. */
  random?: () => number;
}

/** Upper-cased, punctuation-free, so a token never injects the separator. */
function alphanumeric(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The first `length` letters of a name, used when no short code is set. */
export function prefixOf(value: string | null | undefined, length: number): string {
  return alphanumeric(value).slice(0, length);
}

/**
 * A brand or category's code: its short code when it has one, else the first
 * three letters of its name (ADR 0007). The result is always uppercased and
 * stripped of anything that is not A-Z0-9.
 */
export function codeFor(
  shortCode: string | null | undefined,
  name: string | null | undefined
): string {
  const code = alphanumeric(shortCode);

  return code.length > 0 ? code : prefixOf(name, 3);
}

/** `SEQ` zero-pads, everything else truncates, and both cap at a sane length. */
function pad(value: string, length: number): string {
  return value.padStart(length, "0").slice(0, Math.max(length, value.length));
}

function randomString(length: number, random: () => number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";

  for (let index = 0; index < length; index += 1) {
    out += alphabet[Math.floor(random() * alphabet.length)] ?? "0";
  }

  return out;
}

function renderToken(
  token: string,
  length: number | undefined,
  context: SkuContext
): string {
  const date = context.date ?? new Date();

  const take = (value: string | null | undefined, fallbackLength: number) =>
    length === undefined
      ? alphanumeric(value)
      : prefixOf(value, length ?? fallbackLength);

  switch (token) {
    case "BRAND":
      return take(context.brand, 3) || "GEN";
    case "CATEGORY":
      return take(context.category, 3) || "GEN";
    case "NAME":
      return prefixOf(context.name, length ?? 6);
    case "SEQ":
      return pad(String(context.sequence ?? 0), length ?? 5);
    case "YYYY":
      return String(date.getFullYear());
    case "YY":
      return String(date.getFullYear()).slice(-2);
    case "MM":
      return String(date.getMonth() + 1).padStart(2, "0");
    case "RANDOM":
      return randomString(length ?? 4, context.random ?? Math.random);
    default:
      return "";
  }
}

/**
 * Every token in a format, in order, with its optional length. Literal text
 * outside the braces is ignored: a format is a list of tokens, not a template
 * language, so `{BRAND}-{CATEGORY}` and `{BRAND}{CATEGORY}` mean the same thing
 * and the separator decides how they read.
 */
export function tokensIn(format: string): { token: string; length?: number }[] {
  return [...format.matchAll(TOKEN_PATTERN)].map((match) => ({
    token: match[1],
    length: match[2] === undefined ? undefined : Number(match[2]),
  }));
}

/**
 * Whether every `{...}` in a format names a known token. A malformed format is
 * refused at the settings boundary with the offending token named, rather than
 * stored and then silently generating codes missing a piece.
 */
export function parseSkuFormat(
  format: string
): { ok: true; tokens: { token: string; length?: number }[] } | { ok: false; unknown: string[] } {
  const tokens = tokensIn(format);
  const unknown = tokens
    .map((entry) => entry.token)
    .filter((token) => !(SKU_TOKENS as readonly string[]).includes(token));

  const hasBrace = format.includes("{") || format.includes("}");

  if (tokens.length === 0 || unknown.length > 0 || (hasBrace && tokens.length === 0)) {
    return { ok: false, unknown: unknown.length > 0 ? unknown : ["{...}"] };
  }

  return { ok: true, tokens };
}

/** Expand a format into a concrete SKU for one product. */
export function buildSku(
  format: string,
  separator: string,
  context: SkuContext
): string {
  const parts = tokensIn(format)
    .map((entry) => renderToken(entry.token, entry.length, context))
    .filter((part) => part.length > 0);

  return parts.join(separator);
}
