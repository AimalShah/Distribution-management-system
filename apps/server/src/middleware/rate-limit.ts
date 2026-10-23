import rateLimit, {
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Rate limits share two traits on purpose: each answers in the same JSON
 * envelope as the error handler ({ error, code }) so the web client's
 * toFailure seam decodes them without a special case, and each documents its
 * default in-memory store. Memory means the counters sit in this process --
 * correct for the single-node deployment the cap is sized for, and to be
 * revisited (Redis) if the server is ever scaled out behind a load balancer.
 *
 * Both key on req.ip, which behind a TLS-terminating proxy is the proxy's
 * address unless `app.set("trust proxy", ...)` is configured -- see DMS_TRUST_PROXY
 * in `app.ts` before assuming the limits apply per real visitor.
 */

/** Envelope that matches `http/error-handler`'s failure shape. */
const rateLimited = (_req: Request, res: Response) => {
  res.status(429).json({
    error: "Too many requests against the auth surface. Slow down and try again shortly.",
    code: "RATE_LIMITED",
  });
};

/**
 * The wide limiter covering every better-auth endpoint: sign-ups, verification
 * callbacks, get-session, cookie rotation. Generous because all of a small
 * distributor's staff commonly traverse these through one office IP; its job
 * is slowing runaway loops, not costing a clerk their session.
 */
export const authSurfaceLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimited,
});

/**
 * The brute-force limiter on credential entry: an intentionally small budget
 * of failed attempts, and `skipSuccessfulRequests` because someone who signs
 * in correctly should not be spending their failure allowance -- an office
 * whose staff share one IP gets their sign-ins free.
 */
export const credentialEntryLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimited,
});
