import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth, type Auth } from "./index";
import { allowedOrigins } from "../config/env";

/**
 * The origin allowlist better-auth enforces (issue #43).
 *
 * CORS and better-auth have to agree about who may call this API. When they
 * disagree the failure is baffling rather than loud: the browser's preflight
 * passes, so the request is sent, and the server then refuses it as an invalid
 * origin. That is exactly what happened once login moved onto better-auth
 * while `TRUSTED_ORIGINS` named a port the dev server was not serving.
 */

// `DMS_ALLOWED_ORIGINS` is deliberately absent: `allowedOrigins` is read once
// when `config/env` is first imported, so a test cannot vary it after the fact
// and pretend to cover a production origin list. Only `TRUSTED_ORIGINS`, which
// is parsed per `createAuth` call, is exercised here.
const ENV_KEYS = ["TRUSTED_ORIGINS"] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) saved.set(key, process.env[key]);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);

    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

/** The origins better-auth will accept, read off the built instance. */
const trustedOriginsOf = (): string[] => {
  const auth = createAuth();

  // SAFETY: better-auth carries the resolved configuration on the instance it
  // returns; `trustedOrigins` is the array `createAuth` just passed in, and it
  // is the only way to observe the value the server would enforce.
  const { trustedOrigins } = (auth as Auth).options;

  return trustedOrigins;
};

describe("trusted origins", () => {
  it("falls back to the CORS allowlist when TRUSTED_ORIGINS is unset", () => {
    delete process.env.TRUSTED_ORIGINS;

    expect(trustedOriginsOf()).toEqual([...allowedOrigins]);
  });

  it("keeps the CORS allowlist when TRUSTED_ORIGINS adds to it", () => {
    process.env.TRUSTED_ORIGINS = "http://localhost:3000";

    const origins = trustedOriginsOf();

    // An operator adding an extra origin should not have to restate the ones
    // the API already answers, and should never end up with fewer than CORS
    // allows -- that gap is the invalid-origin failure.
    expect(origins).toEqual(expect.arrayContaining([...allowedOrigins]));
    expect(origins).toContain("http://localhost:3000");
  });

  it("never lists the same origin twice", () => {
    process.env.TRUSTED_ORIGINS = "http://localhost:3000,http://localhost:3000";

    const origins = trustedOriginsOf();

    expect(new Set(origins).size).toBe(origins.length);
  });
});