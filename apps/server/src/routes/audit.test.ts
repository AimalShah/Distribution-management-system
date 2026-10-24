import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Auth } from "../auth";
import { USER_HEADER } from "../middleware/auth-context";
import { recordAuditLog } from "../services/audit";

const { auditLogModel, memberModel, dbStub } = vi.hoisted(() => {
  const auditLog = {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  };

  const member = {
    findFirst: vi.fn(),
  };

  return {
    auditLogModel: auditLog,
    memberModel: member,
    dbStub: {
      $transaction: vi.fn(),
      auditLog,
      member,
    },
  };
});

vi.mock("@dms/db", () => ({ default: dbStub, prisma: dbStub }));

const OWNER = "user_owner";

const ORG = "org_1";

const asCaller = (req: request.Test) => req.set(USER_HEADER, OWNER);

describe("Audit Trail API (P2-4)", () => {
  // SAFETY: Mock auth client used for unit testing under trusted-proxy mode
  const app = createApp({ auth: {} as Auth, authMode: "trusted-proxy" });

  beforeEach(() => {
    vi.clearAllMocks();
    memberModel.findFirst.mockResolvedValue({
      id: "mem_1",
      userId: OWNER,
      organizationId: ORG,
      role: "owner",
    });
  });

  it("GET /api/audit returns list of audit logs", async () => {
    const mockLogs = [
      {
        id: "audit_1",
        organizationId: ORG,
        userId: OWNER,
        entityType: "SALE",
        entityId: "SALE-2026-00001",
        action: "CANCEL",
        details: JSON.stringify({ saleCode: "SALE-2026-00001" }),
        ipAddress: null,
        createdAt: new Date().toISOString(),
        user: { id: OWNER, name: "Owner User", email: "owner@test.com" },
      },
    ];

    auditLogModel.findMany.mockResolvedValue(mockLogs);
    auditLogModel.count.mockResolvedValue(1);

    const res = await asCaller(
      request(app).get("/api/audit").set("x-organization-id", ORG)
    );

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].entityType).toBe("SALE");
    expect(res.body.logs[0].action).toBe("CANCEL");
    expect(res.body.total).toBe(1);
  });

  it("recordAuditLog creates an audit record", async () => {
    auditLogModel.create.mockResolvedValue({
      id: "audit_new",
      organizationId: ORG,
      entityType: "SETTINGS",
      entityId: ORG,
      action: "UPDATE",
    });

    await recordAuditLog({
      organizationId: ORG,
      userId: OWNER,
      entityType: "SETTINGS",
      entityId: ORG,
      action: "UPDATE",
      details: { returnWindowDays: 45 },
    });

    expect(auditLogModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG,
        userId: OWNER,
        entityType: "SETTINGS",
        entityId: ORG,
        action: "UPDATE",
        details: JSON.stringify({ returnWindowDays: 45 }),
      }),
    });
  });
});
