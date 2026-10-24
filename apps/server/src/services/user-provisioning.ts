import { hashPassword } from "better-auth/crypto";
import prisma from "@dms/db";
import type {
  AddStaffInput,
  FirstPasswordChangeInput,
  SetMemberStatusInput,
} from "@dms/shared";
import { badRequest, conflict, notFound } from "../http";
import { MEMBER_ROLES } from "../roles";
import {
  requireElevatedMember,
  requireOwnerForRoleChange,
} from "./member";

/**
 * P0-5: staff user management.
 *
 * Before this module, "add member" offered only `available-users` -- accounts
 * that already exist on the install -- and a fresh tenant has none, so an owner
 * could not create their first staff user at all. The account is now created
 * here, the way the legacy `createUserForOrganizationService` used to mint them
 * through better-auth's sign-up: `emailVerified: true` (the owner vouches for
 * the address they typed), a credential `Account` row holding the password
 * hash, and a `Member` row placing the user in the owner's organization.
 *
 * The password is hashed with `hashPassword` from `better-auth/crypto` -- the
 * same routine better-auth's own sign-up and `changePassword` use -- so
 * sign-in, password change and session handling all agree with what the auth
 * handler expects. Nothing here invents a second hashing scheme.
 */

/**
 * The transaction-scoped client, same shape restriction as the other services:
 * the shared client carries a query-logger extension, so the interactive
 * transaction client is the extended type, not the bare `Prisma.TransactionClient`.
 */
type TransactionTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Creator for a new staff member: the user (with the forced-password-change
 * flag set), the credential, and the membership, in one transaction.
 *
 * Partial writes here would be unaccountable: an account without a membership
 * is an orphan nobody can add back through the UI without knowing its id, and
 * a membership without an account is a member row for a user who cannot sign
 * in. One transaction covers all three rows.
 */
export async function createStaff(
  organizationId: string,
  data: AddStaffInput,
  callerUserId: string
) {
  const callerMembership = await requireElevatedMember(
    callerUserId,
    organizationId
  );

  // Creating the *user* with the owner role is granting ownership. Only an
  // owner does that, the same way `addMember` guards it.
  await requireOwnerForRoleChange(
    callerMembership,
    MEMBER_ROLES.member,
    data.role
  );

  const email = data.email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    // Proactive check with an actionable code; User.email carries a global
    // unique index, so a race between two provisions falls through to the
    // P2002 translation and 409s anyway.
    throw conflict(
      "There is already an account with that email address",
      "EMAIL_TAKEN"
    );
  }

  const password = await hashPassword(data.tempPassword);

  const userId = crypto.randomUUID();

  const user = await prisma.$transaction(async (tx: TransactionTx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        name: data.name,
        email,
        emailVerified: true,
        // The account opens in this organization: `User.organizationId` is the
        // pointer the web profile and the available-users heuristic read, and
        // `createOrganization` sets it server-side the same way.
        organizationId,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true, name: true, email: true },
    });

    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        // better-auth's credential-account shape: one row per provider, the
        // account named after its owner's id, the hash in `password`.
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        role: data.role,
        createdAt: new Date(),
      },
    });

    return user;
  });

  return user;
}

/**
 * Deactivate or reactivate a member by its membership id.
 *
 * Deactivation keeps the `Member` row -- history, ledger references and future
 * reactivation -- while locking the *user* out: `User.banned` is what
 * better-auth's sign-in path (the admin-plugin session hook) and the
 * session middlewares read, and every live session is deleted, so a
 * signed-in device is out the moment the write lands.
 */
export async function setMemberStatus(
  memberId: string,
  data: SetMemberStatusInput,
  callerUserId: string
): Promise<{ id: string; userId: string; active: boolean }> {
  const target = await prisma.member.findFirst({
    where: { id: memberId },
    select: { id: true, organizationId: true, userId: true, role: true },
  });

  if (!target) {
    throw notFound("Member not found", "MEMBER_NOT_FOUND");
  }

  const callerMembership = await requireElevatedMember(
    callerUserId,
    target.organizationId
  );

  if (data.active === false) {
    const self = await prisma.member.findFirst({
      where: { id: memberId, userId: callerUserId },
      select: { id: true },
    });

    if (self) {
      // A deactivated caller has no session left to reactivate themselves
      // with, and the reactivate endpoint needs one. The UI hides the button;
      // the server refuses it regardless.
      throw conflict(
        "You cannot deactivate your own account.",
        "CANNOT_DEACTIVATE_SELF"
      );
    }

    // Deactivating an owner is the same step down in authority that a demotion
    // or removal is, so the same guard applies: only owners act on owners, and
    // the last owner is untouchable. A reactivate only widens access, so the
    // ownership guards do not apply to it.
    await requireOwnerForRoleChange(
      callerMembership,
      target.role,
      target.role
    );
  }

  return prisma.$transaction(
    async (tx) => {
      if (
        data.active === false &&
        target.role === MEMBER_ROLES.owner &&
        (await countOwners(tx, target.organizationId)) <= 1
      ) {
        throw conflict(
          "This is the last owner of the organization. Promote another member or restore this one before deactivating.",
          "LAST_OWNER"
        );
      }

      if (data.active === false) {
        // Two writes, one fact. `banned` is what the sign-in path and the
        // middlewares read; the deleted sessions are what actually end the
        // caller's current access -- a user still holding a valid token for a
        // session row would pass every `getSession` until it expired. Deleting
        // by `userId` remains correct when the user is somehow a member of
        // several organizations: ban state is on the user, not the membership.
        const user = await tx.user.update({
          where: { id: target.userId },
          data: {
            banned: true,
            banReason: data.reason?.trim()
              ? data.reason.trim()
              : "Deactivated by an administrator",
            banExpires: null,
          },
          select: { id: true },
        });

        await tx.session.deleteMany({ where: { userId: target.userId } });

        return { id: target.id, userId: user.id, active: false };
      }

      // A reactivate clears all three ban columns, so a half-written or
      // expired-ban state cannot survive the toggle.
      const user = await tx.user.update({
        where: { id: target.userId },
        data: {
          banned: false,
          banReason: null,
          banExpires: null,
        },
        select: { id: true },
      });

      return { id: target.id, userId: user.id, active: true };
    },
    { isolationLevel: "Serializable" }
  );
}

async function countOwners(tx: TransactionTx, organizationId: string) {
  return tx.member.count({ where: { organizationId, role: MEMBER_ROLES.owner } });
}

/**
 * The forced first-login password change: verify the temporary password by
 * letting better-auth perform its own change on the caller's session, then
 * clear the flag that kept every tenant route closed.
 *
 * `auth.api.changePassword` runs the full better-auth path -- current-password
 * verification against the `Account` row, hash with the same routine as
 * sign-up, same password policy (so an 8-character floor is enforced even if
 * this schema is passed a weaker body) -- under the incoming session's own
 * headers. Only a user holding the account's current password is authorized by
 * it; no caller can clear `mustChangePassword` without actually replacing the
 * password.
 */
export async function completeFirstPasswordChange(
  auth: {
    api: {
      changePassword: (args: {
        body: { currentPassword: string; newPassword: string };
        headers?: HeadersInit;
      }) => Promise<unknown>;
    };
  },
  data: FirstPasswordChangeInput,
  userId: string,
  headers: HeadersInit
) {
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      headers,
    });
  } catch (error) {
    // better-auth answers with its own API error naming the real cause
    // ("Incorrect password", password-policy failures, no session). The
    // envelope code stays ours, the message stays theirs.
    const message =
      error instanceof Error && error.message
        ? error.message
        : "The password could not be changed.";

    throw badRequest(message, "PASSWORD_CHANGE_FAILED");
  }

  // The guard middlewares read this column directly, so the write has to land
  // before the caller is told to retry: session state carries no cache of the
  // flag, and the very next tenant request sees the truth. `userId` comes from
  // the session middleware's `req.auth`, not from the client.
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: false },
  });
}
