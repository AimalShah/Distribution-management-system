import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { resend } from "./resend";
import { admin, organization } from "better-auth/plugins";
import { ac, member, owner, adminRole } from "./auth/permission";
import { getActiveOrganization } from "@/actions/organization";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organization = await getActiveOrganization(session.userId);
          return {
            data: {
              ...session,
              activeOrganizationId: organization?.id,
            },
          };
        },
      },
    },
  },
  user: {
    additionalFields: {
      organizationId: {
        type: "string",
        input: true,
        required: false,
      },
      isOwner: {
        type: "boolean",
        input: true,
        required: false,
        defaultValue: false,
      },
      isFormComplete: {
        type: "boolean",
        input: true,
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!process.env.RESEND_API_KEY) {
        console.warn(
          `[auth] RESEND_API_KEY is not set; skipping verification email for ${user.email}`
        );
        return;
      }
      await resend.emails.send({
        from: "Inventioo <onboarding@resend.dev>",
        to: user.email,
        subject: "Email Verfication",
        html: `Click the link to verify your email : ${url}`,
      });
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(","),
  plugins: [
    organization({
      organizationLimit: 5,
      ac,
      roles: {
        owner,
        adminRole,
        member,
      },
    }),
    admin({
      defaultRole: "admin",
    }),
  ],
});
