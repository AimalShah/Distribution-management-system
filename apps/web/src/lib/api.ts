import axios, { isAxiosError } from "axios";
import { z } from "zod";
import { AUTH_TOKEN_KEY } from "./auth-client";

/** The axios adapter: the transport this module keeps private behind the seam. */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  // Sends the better-auth session cookie when the API is on another origin.
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * One request leaves the app, one error comes back.
 *
 * This module is the seam every page sends its traffic through. `api` is the
 * interface a page programs against; its implementation sits on the private
 * axios adapter `client`, so the transport stays behind the seam and no page
 * touches an axios instance. `RequestFailure` is the interface a page reads on
 * a refusal, and `toFailure` is the single implementation of the translation —
 * the server envelope `{ error, code, details? }` is decoded here and nowhere
 * else, so no page parses an axios error again. The leverage of putting the
 * decode at one seam is that `code` (why the server refused) and `details`
 * (what it refused on) reach the caller with locality: the whole error
 * contract lives in this one file.
 */

/** Where a failure came from: the server's envelope, the network, or local code. */
export type FailureOrigin = "server" | "network" | "local";

/** The translated failure a page branches on. */
export interface RequestFailure {
  /** The server answered, the network never delivered, or the failure is local. */
  origin: FailureOrigin;
  /** HTTP status when the server answered; null otherwise. */
  status: number | null;
  /** Machine-readable refusal, e.g. INSUFFICIENT_STOCK or SALE_HAS_PAYMENTS. */
  code: string | null;
  /** Structured payload behind the refusal (shortages, shortfall); `shortfallLine` reads it. */
  details: unknown;
  /** Human copy: the envelope's `error` when the server sent one, else the caller's fallback. */
  message: string;
}

/** The only error envelope the server emits: `{ error, code, details? }`. */
const failureEnvelope = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

/** One line of the `shortages` list a multi-product refusal carries. */
const shortageLine = z.object({
  productId: z.string(),
  available: z.number(),
  requested: z.number(),
});

/** `{ shortages: [...] }` as built for a multi-line refusal. */
const shortageList = z.object({
  shortages: z.array(shortageLine),
});

/** `{ available, requested }` (optionally with a product id) for a single movement. */
const singleShortage = z.object({
  productId: z.string().optional(),
  available: z.number(),
  requested: z.number(),
});

/**
 * The seam itself: every GET, POST, PUT and DELETE a page issues leaves through
 * `api` and comes back with the response envelope unwrapped. Failures are not
 * decoded at this level — a rejection is translated exactly once, by
 * `toFailure`, when the page catches it.
 */
export const api = {
  get: (url: string) => client.get(url).then((response) => response.data),

  post: <T>(url: string, body?: T) => client.post(url, body).then((response) => response.data),

  put: <T>(url: string, body?: T) => client.put(url, body).then((response) => response.data),

  // PATCH is a partial update, and the server has endpoints that only speak it
  // (`PATCH /members/:id/role`). A page reaching past this to the axios client
  // for those would be the one place the transport is not behind the seam.
  patch: <T>(url: string, body?: T) => client.patch(url, body).then((response) => response.data),

  delete: (url: string) => client.delete(url).then((response) => response.data),
};

/** The shared SWR fetcher: one GET through the seam, envelope unwrapped. */
export const fetcher = (url: string) => api.get(url);

/**
 * Translate a caught rejection into the failure interface, once. The caller
 * hands over whatever it caught and keeps locality over its own copy (the
 * fallback string); the axios envelope is parsed here, so `code` and `details`
 * arrive without the page ever touching `err.response`.
 */
/**
 * Typed `unknown` rather than `Error` because that is what a `catch` clause
 * actually binds: the rejection may be an axios error, a plain `Error`, or
 * anything at all. Every branch below already handles a non-axios value by
 * answering with the caller's fallback, so nothing here trusts the shape.
 */
export const toFailure = (err: unknown, fallback: string): RequestFailure => {
  if (!isAxiosError(err)) {
    return { origin: "local", status: null, code: null, details: undefined, message: fallback };
  }

  const response = err.response;

  if (response === undefined) {
    return { origin: "network", status: null, code: null, details: undefined, message: fallback };
  }

  const envelope = failureEnvelope.safeParse(response.data);

  if (!envelope.success) {
    return {
      origin: "server",
      status: response.status,
      code: null,
      details: undefined,
      message: fallback,
    };
  }

  return {
    origin: "server",
    status: response.status,
    code: envelope.data.code ?? null,
    details: envelope.data.details,
    message: envelope.data.error,
  };
};

/** The human half of `toFailure`: the envelope's copy when it sent one, else the fallback. */
export const failureMessage = (err: unknown, fallback: string): string =>
  toFailure(err, fallback).message;

/**
 * The stock shortfall behind a refusal, as one line to append to its message —
 * " — Wireless Mouse: 2 available, 5 requested" — or an empty string when the
 * failure carried no stock detail. `productLabel` maps a product id to display
 * copy; without it the ids are left out rather than shown raw.
 */
export const shortfallLine = (
  failure: RequestFailure,
  productLabel?: (productId: string) => string,
): string => {
  const listed = shortageList.safeParse(failure.details);

  if (listed.success) {
    const lines = listed.data.shortages.map((line) => {
      const label = productLabel === undefined ? "" : `${productLabel(line.productId)}: `;

      return `${label}${line.available} available, ${line.requested} requested`;
    });

    return lines.length === 0 ? "" : ` — ${lines.join("; ")}`;
  }

  const single = singleShortage.safeParse(failure.details);

  if (single.success) {
    const label =
      productLabel !== undefined && single.data.productId !== undefined
        ? `${productLabel(single.data.productId)}: `
        : "";

    return ` — ${label}${single.data.available} available, ${single.data.requested} requested`;
  }

  return "";
};
