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
  const baseURL =
    process.env.BETTER_AUTH_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    undefined;

  return betterAuth({
    ...(baseURL ? { baseURL } : {}),
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
        // P0-5 staff provisioning. `input: false` for the same reason as
        // `organizationId`: the flag is server-written (set when an owner
        // provisions a staff account, cleared only by the first-login password
        // change endpoint), and a client that could set or clear it could
        // either skip the forced password change or lock someone out. Carried
        // on the session response so the web can route a provisioned staff to
        // the change-password screen before any tenant call is refused.
        mustChangePassword: {
          type: "boolean",
          input: false,
          required: false,
          defaultValue: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification:
        options.requireEmailVerification ??
        process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
      sendResetPassword: async ({ user, url }) => {
        await send({
          to: user.email,
          subject: "Reset your password",
          html: `Click the link to reset your password: ${url}`,
        });
      },
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
    // The union of both knobs, not one replacing the other. CORS and
    // better-auth have to agree about who may call this API; when they
    // disagreed the browser's preflight passed, the request was sent, and the
    // server then refused it as an invalid origin -- a failure with no obvious
    // cause. `TRUSTED_ORIGINS` names extra origins to allow, not the whole
    // list, so setting it can no longer shrink what CORS already permits.
    trustedOrigins: [...new Set([...allowedOrigins, ...trustedOrigins])],
    plugins: [
      organization({
        organizationLimit: 5,
        ac,
        roles: { owner, adminRole, member },
        sendInvitationEmail: async (data) => {
          const baseUrl =
            process.env.VITE_SERVER_URL ||
            process.env.BETTER_AUTH_URL ||
            process.env.RENDER_EXTERNAL_URL ||
            "https://am-enterprise.org";
          const inviteUrl = `${baseUrl}/accept-invitation/${data.id}`;
          await send({
            to: data.email,
            subject: `Invitation to join ${data.organization.name}`,
            html: `You have been invited to join ${data.organization.name} on AM-Enterprise as ${data.role}.\n\nClick here to accept your invitation: ${inviteUrl}`,
          });
        },
      }),
      // `defaultRole: "user"`, not the legacy's `"admin"`. The admin plugin's
      // role is global, not per-organization: with `"admin"` as the default,
      // every sign-up could list, ban, impersonate and delete every user in
      // every tenant. Administrators are granted explicitly -- `User.role =
      // "admin"`, or `DMS_ADMIN_USER_IDS` for bootstrapping the first one.
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
        adminUserIds: parseList(process.env.DMS_ADMIN_USER_IDS),
        // Deactivation writes `User.banned` directly (provisioning service), so
        // this is the message a deactivated user sees when better-auth's own
        // session-creation hook rejects their sign-in.
        bannedUserMessage:
          "This account has been deactivated. Contact the owner of your organization.",
      }),
      // `Authorization: Bearer <session token>`, for the Electron shell and the
      // axios client in `apps/web/src/lib/api.ts`, neither of which can rely on
      // a cookie. The token is the same session token the cookie carries.
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
