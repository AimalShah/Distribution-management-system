import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { orderBookerModel } = vi.hoisted(() => ({
  orderBookerModel: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@dms/db", () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    member: { findFirst: async () => ({ role: "owner" }) },
    orderBooker: orderBookerModel,
  },
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    member: { findFirst: async () => ({ role: "owner" }) },
    orderBooker: orderBookerModel,
  },
}));

const app = createApp();
const ORG = "org_1";

const bookerFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "ob_1",
  organizationId: ORG,
  code: "OB-001",
  name: "John Booker",
  phone: "555-0199",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  orderBookerModel.findMany.mockResolvedValue([bookerFixture()]);
  orderBookerModel.count.mockResolvedValue(1);
  orderBookerModel.findFirst.mockResolvedValue(bookerFixture());
  orderBookerModel.create.mockResolvedValue(bookerFixture());
  orderBookerModel.update.mockResolvedValue(bookerFixture());
});

describe("GET /api/order-bookers", () => {
  it("rejects request without organization header", async () => {
    const res = await request(app).get("/api/order-bookers");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
  });

  it("returns paginated order bookers scoped to the organization", async () => {
    const res = await request(app)
      .get("/api/order-bookers")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].code).toBe("OB-001");
    expect(orderBookerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG }),
      })
    );
  });

  it("filters by isActive when specified", async () => {
    await request(app)
      .get("/api/order-bookers?isActive=true")
      .set(ORGANIZATION_HEADER, ORG);

    expect(orderBookerModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG,
          isActive: true,
        }),
      })
    );
  });
});

describe("POST /api/order-bookers", () => {
  it("rejects invalid payload missing required code or name", async () => {
    const res = await request(app)
      .post("/api/order-bookers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ phone: "555-1234" });

    expect(res.status).toBe(400);
  });

  it("creates a new order booker with valid payload", async () => {
    orderBookerModel.findFirst.mockResolvedValue(null); // No collision on code
    const res = await request(app)
      .post("/api/order-bookers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({
        code: "OB-002",
        name: "Alice Booker",
        phone: "555-4321",
      });

    expect(res.status).toBe(201);
    expect(orderBookerModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG,
        code: "OB-002",
        name: "Alice Booker",
        phone: "555-4321",
        isActive: true,
      }),
    });
  });

  it("returns 409 conflict when code already exists in organization", async () => {
    orderBookerModel.findFirst.mockResolvedValue(bookerFixture({ code: "OB-001" }));
    const res = await request(app)
      .post("/api/order-bookers")
      .set(ORGANIZATION_HEADER, ORG)
      .send({
        code: "OB-001",
        name: "Duplicate Booker",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ORDER_BOOKER_CODE_EXISTS");
  });
});

describe("PATCH /api/order-bookers/:id", () => {
  it("returns 404 if order booker does not exist in organization", async () => {
    orderBookerModel.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .patch("/api/order-bookers/ob_999")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ name: "Updated Name" });

    expect(res.status).toBe(404);
  });

  it("updates order booker fields and active status", async () => {
    orderBookerModel.findFirst.mockResolvedValue(bookerFixture());
    orderBookerModel.update.mockResolvedValue(bookerFixture({ isActive: false }));

    const res = await request(app)
      .patch("/api/order-bookers/ob_1")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(orderBookerModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ob_1" },
        data: expect.objectContaining({ isActive: false }),
      })
    );
  });
});
