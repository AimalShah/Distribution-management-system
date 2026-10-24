import { describe, expect, it, vi } from "vitest";

import { applyTenantMutation, parseMutationEvent } from "./mutation";

describe("tenant mutation events", () => {
  it("routes a server domain event through the shared client invalidation map", () => {
    const domain = vi.fn();
    const all = vi.fn();
    const event = parseMutationEvent('{"domain":"payments"}');

    expect(event).toEqual({ domain: "payments" });

    if (event) applyTenantMutation(event, { domain, all });

    expect(domain).toHaveBeenCalledWith("payments");
    expect(all).not.toHaveBeenCalled();
  });

  it("invalidates all active queries after an all-domain event", () => {
    const domain = vi.fn();
    const all = vi.fn();
    const event = parseMutationEvent('{"domain":"all"}');

    if (event) applyTenantMutation(event, { domain, all });
    expect(all).toHaveBeenCalledOnce();
    expect(domain).not.toHaveBeenCalled();
  });

  it("ignores malformed or unknown event data", () => {
    expect(parseMutationEvent("no json")).toBeUndefined();
    expect(parseMutationEvent('{"domain":"made-up"}')).toBeUndefined();
  });
});
