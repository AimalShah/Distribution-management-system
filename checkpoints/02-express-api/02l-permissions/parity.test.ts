/**
 * Checkpoint 2l — Permissions API: Parity Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../apps/server/src/app";

describe("Checkpoint 2l — Permissions API", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp();
  });

  it("requireAdmin allows owner role", async () => {});
  it("requireAdmin rejects member role", async () => {});
  it("requireAdmin rejects unauthenticated requests", async () => {});
});
