type DecimalInput = number | string | { toString(): string };

/** Convert a decimal currency amount to integer Pakistani paise. */
export function toPaise(value: DecimalInput): bigint {
  return decimalToScaledInteger(value, 2);
}

/** Convert a paise integer to the number shape used by current JSON APIs. */
export function fromPaise(value: bigint): number {
  return Number(value) / 100;
}

/** Normalize a stored decimal value to the number contract used in API DTOs. */
export function toMoneyNumber(value: DecimalInput): number {
  return fromPaise(toPaise(value));
}

/** Calculate a percentage of a paise amount, rounding half away from zero. */
export function percentagePaise(amountPaise: bigint, ratePercent: DecimalInput): bigint {
  const rateBasisPoints = decimalToScaledInteger(ratePercent, 2);

  return roundRatio(amountPaise * rateBasisPoints, 10_000n);
}

/** Produce an exact decimal string suitable for a Prisma Decimal write. */
export function paiseToDecimal(value: bigint): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / 100n;
  const fraction = String(magnitude % 100n).padStart(2, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Convert Prisma Decimal instances to the application's numeric JSON contract. */
export function normalizeDecimalValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeDecimalValues);
  if (value === null || typeof value !== "object" || value instanceof Date) return value;

  // SAFETY: Prisma's minified runtime exports Decimal with a minified constructor name.
  // We check static isDecimal, constructor.name, or Decimal.js internal shape (toFixed + array d).
  const decimal = value as {
    constructor?: { name?: string; isDecimal?: (v: unknown) => boolean };
    toString?: () => string;
    toFixed?: unknown;
    d?: unknown;
  };

  const isDecimal =
    (typeof decimal.constructor?.isDecimal === "function" && decimal.constructor.isDecimal(value)) ||
    decimal.constructor?.name === "Decimal" ||
    (typeof decimal.toFixed === "function" && Array.isArray(decimal.d));

  if (isDecimal && typeof decimal.toString === "function") {
    return toMoneyNumber(decimal.toString());
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, normalizeDecimalValues(child)])
  );
}

function decimalToScaledInteger(value: DecimalInput, decimalPlaces: number): bigint {
  if (value == null) return 0n;
  const raw = (typeof value === "number" ? value.toString() : value.toString().trim()).toLowerCase();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/.exec(raw);

  if (!match || (!match[2] && !match[3])) {
    throw new TypeError(`Invalid decimal amount: ${raw}`);
  }

  const negative = match[1] === "-";
  let whole = match[2] || "0";
  let fraction = match[3] || "";
  const exponent = Number(match[4] || 0);

  if (exponent > 0) {
    if (fraction.length <= exponent) {
      whole = whole + fraction + "0".repeat(exponent - fraction.length);
      fraction = "";
    } else {
      whole = whole + fraction.slice(0, exponent);
      fraction = fraction.slice(exponent);
    }
  } else if (exponent < 0) {
    const shift = -exponent;
    if (whole.length <= shift) {
      fraction = "0".repeat(shift - whole.length) + whole + fraction;
      whole = "0";
    } else {
      fraction = whole.slice(whole.length - shift) + fraction;
      whole = whole.slice(0, whole.length - shift);
    }
  }

  // Remove leading zeros from whole
  whole = whole.replace(/^0+/, "") || "0";

  // Take decimalPlaces from fraction with half-up rounding on excess precision
  const keptFraction = fraction.padEnd(decimalPlaces, "0").slice(0, decimalPlaces);
  const nextDigit = fraction.length > decimalPlaces ? Number(fraction[decimalPlaces]) : 0;

  let result = BigInt(whole + keptFraction);
  if (nextDigit >= 5) {
    result += 1n;
  }

  return negative ? -result : result;
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const rounded = (magnitude + denominator / 2n) / denominator;

  return negative ? -rounded : rounded;
}
