import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { configuredCredentials, signSessionToken } from "../services/auth";

const app = createApp();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/login", () => {
  it("accepts the configured credentials and answers with a token", async () => {
    const { username, password } = configuredCredentials();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.username).toBe(username);
  });

  it("rejects a wrong password with 401, not a 500 or a 200", async () => {
    const { username } = configuredCredentials();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "not-the-password" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
    expect(res.body).not.toHaveProperty("token");
  });

  it("rejects an unknown username", async () => {
    const { password } = configuredCredentials();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("validates the body before touching the credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("honours DMS_AUTH_USERNAME / DMS_AUTH_PASSWORD overrides", async () => {
    vi.stubEnv("DMS_AUTH_USERNAME", "operator");
    vi.stubEnv("DMS_AUTH_PASSWORD", "s3cret-pass");

    const accepted = await request(app)
      .post("/api/auth/login")
      .send({ username: "operator", password: "s3cret-pass" });
    expect(accepted.status).toBe(200);

    const rejected = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    expect(rejected.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("answers for a token it signed", async () => {
    const { username, name } = configuredCredentials();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signSessionToken({ username, name })}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ username, name });
  });

  it("401s with no header at all", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_SESSION");
  });

  it("401s on a token whose payload was edited", async () => {
    const forged = Buffer.from(
      JSON.stringify({ sub: "admin", name: "Administrator", expiresAt: 9_999_999_999 })
    ).toString("base64url");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${forged}.not-a-real-signature`);

    expect(res.status).toBe(401);
  });

  it("401s on a token signed with a different secret", async () => {
    const { username, name } = configuredCredentials();
    vi.stubEnv("DMS_AUTH_SECRET", "the-wrong-secret");
    const foreign = signSessionToken({ username, name });
    vi.unstubAllEnvs();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${foreign}`);

    expect(res.status).toBe(401);
  });

  it("ignores an Authorization header that is not a bearer token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Basic YWRtaW46YWRtaW4xMjM=");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("answers 204 so the client can drop its token", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(204);
  });
});

describe("tenant middleware", () => {
  it("leaves the sign-in route reachable without an organization header", async () => {
    const { username, password } = configuredCredentials();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password });

    expect(res.status).toBe(200);
  });
});
