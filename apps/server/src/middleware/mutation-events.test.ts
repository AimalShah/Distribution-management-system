import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  mutationDomainForPath,
  publishSuccessfulMutation,
} from "./mutation-events";
import {
  publishTenantMutation,
  subscribeToTenantEvents,
} from "../utils/tenant-events";

const responseWriter = () => {
  const writes: string[] = [];

  return {
    writes,
    response: {
      destroyed: false,
      writableEnded: false,
      write: (chunk: string) => {
        writes.push(chunk);

        return true;
      },
      end: () => {},
    },
  };
};

describe("tenant mutation events", () => {
  it("resolves API paths to the domains consumed by the client registry", () => {
    expect(mutationDomainForPath("/api/sales/sale-1?expand=items")).toBe("sales");
    expect(mutationDomainForPath("/api/organizations/org-1/members")).toBe("all");
    expect(mutationDomainForPath("/api/events")).toBeUndefined();
    expect(mutationDomainForPath("/api/reports/sales")).toBeUndefined();
  });

  it("publishes a domain only to subscribers in that tenant", () => {
    const firstTenant = responseWriter();
    const secondTenant = responseWriter();
    const unsubscribe = subscribeToTenantEvents("realtime-org-a", firstTenant.response);
    const unsubscribeSecond = subscribeToTenantEvents("realtime-org-b", secondTenant.response);

    publishTenantMutation("realtime-org-a", "payments");
    unsubscribe();
    unsubscribeSecond();
    publishTenantMutation("realtime-org-a", "sales");

    expect(firstTenant.writes).toHaveLength(1);
    expect(firstTenant.writes[0]).toContain('data: {"domain":"payments"}');
    expect(secondTenant.writes).toEqual([]);
  });

  it("broadcasts only successful writes", async () => {
    const app = express();
    const subscriber = responseWriter();
    const unsubscribe = subscribeToTenantEvents("realtime-org-write", subscriber.response);
    app.use((req, _res, next) => {
      req.auth = { organizationId: "realtime-org-write" };
      next();
    });
    app.use(publishSuccessfulMutation);
    app.post("/api/sales", (_req, res) => res.sendStatus(201));
    app.post("/api/returns", (_req, res) => res.sendStatus(409));

    await request(app).post("/api/sales");
    await request(app).post("/api/returns");
    unsubscribe();

    expect(subscriber.writes).toHaveLength(1);
    expect(subscriber.writes[0]).toContain('data: {"domain":"sales"}');
  });
});
