import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // This suite mocks `@dms/db`, so there is no session table for better-auth
    // to resolve a caller from. It asserts routing, validation and tenant
    // scoping, and drives them through the trusted-proxy headers
    // (`middleware/auth-context.ts`). The session path is covered against a
    // real database by `checkpoints/03-auth/parity.test.ts`, and the session
    // middleware itself by `middleware/session.test.ts`, which sets its mode
    // explicitly.
    env: { DMS_TRUSTED_PROXY_AUTH: "true" },
  },
});
