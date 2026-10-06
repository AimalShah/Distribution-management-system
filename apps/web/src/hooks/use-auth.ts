import { authClient } from "../lib/auth-client";

/**
 * The current session, or `null` when signed out.
 *
 * better-auth's own `useSession` rather than an SWR or React Query wrapper
 * around `getSession()`: it is already a cached, shared store, and -- unlike a
 * query keyed on "session" -- it refreshes itself when `signIn`, `signOut` or
 * `organization.setActive` run through `authClient`, so no screen has to
 * remember to invalidate it.
 */
export function useAuth() {
  return authClient.useSession();
}

export function useActiveOrganization() {
  return authClient.useActiveOrganization();
}
