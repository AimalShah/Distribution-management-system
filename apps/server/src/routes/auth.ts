import express, { Router } from "express";
import { z } from "zod";
import { asyncHandler, unauthorized } from "../http";
import {
  bearerToken,
  signSessionToken,
  verifyCredentials,
  verifySessionToken,
} from "../services/auth";

export const authRouter: Router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Mounted ahead of the tenant middleware in `app.ts`: a caller who has not
 * logged in has no session to read an organization from, and asking them for
 * one before they can sign in would answer the wrong question.
 */
authRouter.post(
  "/login",
  express.json(),
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const user = verifyCredentials(username, password);

    if (!user) {
      throw unauthorized("Invalid username or password", "INVALID_CREDENTIALS");
    }

    res.json({ token: signSessionToken(user), user });
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const claims = verifySessionToken(bearerToken(req.header("authorization")));

    if (!claims) {
      throw unauthorized("Missing or expired session token", "INVALID_SESSION");
    }

    res.json({ user: { username: claims.username, name: claims.name } });
  })
);

/**
 * Stateless tokens cannot be revoked server side, so signing out is the
 * client dropping what it holds. The endpoint exists to keep that step a real
 * round trip -- a future session store replaces the body of this handler and
 * no client changes.
 */
authRouter.post("/logout", (_req, res) => {
  res.status(204).end();
});
