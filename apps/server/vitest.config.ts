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
    //
    // `DMS_USER_ID` supplies the identity the trusted-proxy header would carry,
    // so a request without `x-user-id` still arrives with an attributed caller
    // and the permission guard can answer "may they?" rather than "who are
    // they?". A test asserting the 400 that an unattributable caller earns
    // stubs the variable back to empty for that case.
    env: { DMS_TRUSTED_PROXY_AUTH: "true", DMS_USER_ID: "usr_unit_caller" },
    unstubEnvs: true,
  },
});
