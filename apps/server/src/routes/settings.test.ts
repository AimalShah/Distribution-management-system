import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { ORGANIZATION_HEADER } from "../middleware/auth-context";

const { companySettingsModel, memberModel } = vi.hoisted(() => ({
  companySettingsModel: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  memberModel: { findFirst: vi.fn() },
}));

vi.mock("@dms/db", () => ({
  default: {
    member: memberModel,
    companySettings: companySettingsModel,
  },
  prisma: {
    member: memberModel,
    companySettings: companySettingsModel,
  },
}));

const app = createApp();

const ORG = "org_1";
const OTHER_ORG = "org_2";

const storedSettings = {
  id: "set_1",
  organizationId: ORG,
  displayName: "Acme Distribution",
  address: "12 Market Road",
  gstin: "27AAPFU0939F1ZV",
  skuFormat: "{BRAND}-{CATEGORY}-{SEQ:5}",
  skuSeparator: "-",
  skuSequence: 0,
  returnWindowDays: 30,
  returnsEnabled: true,
  creditTermDays: 30,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  memberModel.findFirst.mockResolvedValue({ role: "owner" });
  companySettingsModel.findUnique.mockResolvedValue(storedSettings);
  companySettingsModel.upsert.mockResolvedValue(storedSettings);
});

describe("organization context", () => {
  it("rejects an unscoped read without touching the database", async () => {
    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(companySettingsModel.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unscoped write without touching the database", async () => {
    const res = await request(app).put("/api/settings").send({ displayName: "X" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ORGANIZATION_REQUIRED");
    expect(companySettingsModel.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/settings", () => {
  it("reads the active Company's settings", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Acme Distribution");
    expect(companySettingsModel.findUnique).toHaveBeenCalledWith({
      where: { organizationId: ORG },
    });
  });

  it("falls back to defaults when the Company has never saved settings", async () => {
    companySettingsModel.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/settings")
      .set(ORGANIZATION_HEADER, ORG);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      organizationId: ORG,
      displayName: null,
      skuFormat: "{BRAND}-{CATEGORY}-{SEQ:5}",
      returnWindowDays: 30,
      returnsEnabled: true,
      creditTermDays: 30,
      skuSequence: 0,
    });
  });
});

describe("PUT /api/settings", () => {
  it("upserts scoped to the active Company, not the body", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set(ORGANIZATION_HEADER, ORG)
      .send({
        displayName: "Acme Distribution",
        address: "12 Market Road",
        gstin: "27aapfu0939f1zv",
        organizationId: OTHER_ORG,
      });

    expect(res.status).toBe(200);
    expect(companySettingsModel.upsert).toHaveBeenCalledTimes(1);

    const call = companySettingsModel.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: ORG });
    expect(call.create.organizationId).toBe(ORG);
    // The GSTIN is normalised to uppercase; a body-carried organizationId is
    // not part of the schema and never reaches the write.
    expect(call.create.gstin).toBe("27AAPFU0939F1ZV");
    expect(call.create.organizationId).not.toBe(OTHER_ORG);
  });

  it("rejects a malformed GSTIN without writing", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ gstin: "not-a-gstin" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(companySettingsModel.upsert).not.toHaveBeenCalled();
  });

  it("accepts blank profile fields as a clear", async () => {
    await request(app)
      .put("/api/settings")
      .set(ORGANIZATION_HEADER, ORG)
      .send({ displayName: "", address: "   ", gstin: "" });

    const call = companySettingsModel.upsert.mock.calls[0][0];
    expect(call.update.displayName).toBeNull();
    expect(call.update.address).toBeNull();
    expect(call.update.gstin).toBeNull();
  });
});
