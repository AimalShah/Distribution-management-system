import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test"
      ? "silent"
      : process.env.NODE_ENV === "production"
        ? "info"
        : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "password",
      "tempPassword",
      "currentPassword",
      "newPassword",
      "token",
    ],
    censor: "[Redacted]",
  },
});
