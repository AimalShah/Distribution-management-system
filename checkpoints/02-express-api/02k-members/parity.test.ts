/**
 * Checkpoint 2k — Members API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2k — Members API", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(async () => {
    app = createApp();
  });

  it("GET /api/organizations/:id/members returns members", async () => {});
  it("POST /api/organizations/:id/members adds member", async () => {});
  it("DELETE /api/members/:id removes member", async () => {});
  it("GET /api/organizations/:id/available-users returns non-members", async () => {});
});
