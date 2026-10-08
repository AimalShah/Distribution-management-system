/**
 * Checkpoint 7 — Batch/Lot Inventory + Expiry KPI: Acceptance Test
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../../apps/server/src/app";
import {
  batchListQuerySchema,
  stockBatchCreateSchema,
} from "@dms/shared";
import {
  ORGANIZATION_HEADER,
  USER_HEADER,
} from "../../apps/server/src/middleware/auth-context";

describe("Checkpoint 7 — Batch/Lot Inventory Acceptance", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({ authMode: "header" });
  });

  it("batchListQuerySchema validates batch query parameters", () => {
    const result = batchListQuerySchema.safeParse({
      page: 1,
      pageSize: 20,
      expiringWithinDays: 30,
      search: "BATCH-123",
    });

    expect(result.success).toBe(true);
  });

  it("stockBatchCreateSchema validates batch creation fields", () => {
    const result = stockBatchCreateSchema.safeParse({
      productId: "prod-abc",
      batchNumber: "LOT-999",
      quantity: 100,
      unitCost: 10.5,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.quantity).toBe(100);
      expect(result.data.batchNumber).toBe("LOT-999");
    }
  });

  it("serves batch inventory API routes under /api/inventory/batches", async () => {
    const res = await request(app)
      .get("/api/inventory/batches")
      .set(ORGANIZATION_HEADER, "org-test-123")
      .set(USER_HEADER, "user-test-123");

    // Endpoint is registered and reachable (not 404)
    expect(res.status).not.toBe(404);
  });

  it("serves expiring soon batches endpoint under /api/inventory/batches/expiring", async () => {
    const res = await request(app)
      .get("/api/inventory/batches/expiring?days=30")
      .set(ORGANIZATION_HEADER, "org-test-123")
      .set(USER_HEADER, "user-test-123");

    expect(res.status).not.toBe(404);
  });
});
