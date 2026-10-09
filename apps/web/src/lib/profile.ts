import useSWR from "swr";
import { authClient } from "./auth-client";

/**
 * The signed-in user's membership in the active Company (issue #43).
 *
 * Role and Company are not on the session: the session says *which* Company is
 * active, and the membership row says what this user is called there. Both come
 * from better-auth's organization plugin, which is the only thing that knows
 * them.
 *
 * A failure here is not fatal. Someone who belongs to no Company, or whose
 * membership was removed while their session lived on, still has a profile —
 * they just have no role to show — so the error is swallowed and the page
 * renders the parts it does know rather than an empty screen.
 */
export interface ActiveMembership {
  role: string;
  organizationName: string;
  /** The active Company's id, which every membership route is scoped by. */
  organizationId: string;
}

export function useActiveMembership() {
  const { data, isLoading } = useSWR("active-membership", async () => {
    // better-auth's client resolves to `{ data, error }` rather than throwing,
    // so each result is unwrapped here; a refusal becomes a missing value and
    // the page still renders the parts it does know.
    const [member, full] = await Promise.all([
      authClient.organization.getActiveMember(),
      authClient.organization.getFullOrganization(),
    ]);

    if (member.error || full.error) {
      throw new Error(
        member.error?.message ??
          full.error?.message ??
          "Could not read the active membership"
      );
    }

    return {
      role: member.data?.role ?? "",
      // `get-full-organization` returns the organization's own fields spread
      // alongside `members` and `invitations`, not nested under a key.
      organizationName: full.data?.name ?? "",
      organizationId: full.data?.id ?? "",
    } satisfies ActiveMembership;
  });

  return { membership: data ?? null, isLoading: Boolean(isLoading) };
}