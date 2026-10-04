import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, bearer, organization } from "better-auth/plugins";
import prisma from "@dms/db";
import { allowedOrigins } from "../config/env";
import { sendEmail as sendViaResend, type Email } from "./email";
import { ac, adminRole, member, owner } from "./permissions";

export interface AuthOptions {
  /**
   * Defaults to the legacy rule: on, unless `REQUIRE_EMAIL_VERIFICATION=false`.
   * Taken as an option as well so a test can exercise both sides of it without
   * mutating `process.env` before the module graph loads.
   */
  requireEmailVerification?: boolean;
  /** Defaults to Resend. Tests pass a capture to read the verification link. */
  sendEmail?: (email: Email) => Promise<void>;
}

const parseList = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

/**
 * The organization a new session starts in: the user's oldest membership.
 *
 * Ported from the legacy `databaseHooks.session.create.before`. Without it a
 * freshly signed-in user has no `activeOrganizationId`, and every tenant route
 * answers 400 ORGANIZATION_REQUIRED until the client calls `set-active` -- which
 * the legacy UI never did, because the hook made it unnecessary.
 */
async function firstOrganizationId(userId: string): Promise<string | undefined> {
  const membership = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return membership?.organizationId;
}

/**
 * A factory rather than a module-level singleton so `createApp` can be handed a
 * differently configured instance. The configuration itself is pure: nothing
 * here touches the database until a request arrives.
 */
export function createAuth(options: AuthOptions = {}) {
  const send = options.sendEmail ?? sendViaResend;
  const trustedOrigins = parseList(process.env.TRUSTED_ORIGINS);

  return betterAuth({
    basePath: "/api/auth",
    // The extended client (`$extends` query logging) exposes the same model
    // delegates the adapter calls; its type is just not nominally `PrismaClient`.
    database: prismaAdapter(prisma as never, { provider: "postgresql" }),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({
            data: {
              ...session,
              activeOrganizationId: await firstOrganizationId(session.userId),
            },
          }),
        },
      },
    },
    user: {
      additionalFields: {
        // `input: false`, unlike the legacy. A tenant pointer the client writes at
        // sign-up is the exact pattern that produced the cross-tenant defects in
        // checkpoint 2. Nothing on the server resolves a tenant from it any more
        // -- membership comes from `Member` rows -- and `createOrganization`
        // still sets it server-side for the screens that read it.
        organizationId: { type: "string", input: false, required: false },
        // Display-only: the legacy sidebar shows "Admin" when it is set. No
        // authorization decision reads it.
        isOwner: { type: "boolean", input: true, required: false, defaultValue: false },
        isFormComplete: { type: "boolean", input: true, required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification:
        options.requireEmailVerification ??
        process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await send({
          to: user.email,
          subject: "Email Verification",
          html: `Click the link to verify your email: ${url}`,
        });
      },
    },
    trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : [...allowedOrigins],
    plugins: [
      organization({ organizationLimit: 5, ac, roles: { owner, adminRole, member } }),
      // `defaultRole: "user"`, not the legacy's `"admin"`. The admin plugin's
      // role is global, not per-organization: with `"admin"` as the default,
      // every sign-up could list, ban, impersonate and delete every user in
      // every tenant. Administrators are granted explicitly -- `User.role =
      // "admin"`, or `DMS_ADMIN_USER_IDS` for bootstrapping the first one.
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        adminUserIds: parseList(process.env.DMS_ADMIN_USER_IDS),
      }),
      // `Authorization: Bearer <session token>`, for the Electron shell and the
      // axios client in `apps/web/src/lib/api.ts`, neither of which can rely on
      // a cookie. The token is the same session token the cookie carries.
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
