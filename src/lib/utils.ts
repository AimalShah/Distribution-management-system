import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type FetchError = Error & {
  info?: unknown;
  status?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetcher = async <T = any>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    const error: FetchError = new Error(
      "An error occurred while fetching the data."
    ) as FetchError;
    try {
      error.info = await response.json();
    } catch {
      error.info = null;
    }
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
};
export function toCamelCase(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function generateCode(prefix: string): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `${prefix}-${code}`;
}

export function generateSaleInvoiceCode(): string {
  const characters = "0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  const year = new Date().getFullYear();
  return `SALE-${year}-${code}`;
}
