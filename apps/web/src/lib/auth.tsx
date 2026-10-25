import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "./auth-client";
import { resetUnauthorizedRedirect } from "./api";
import { startTenantMutationStream } from "./mutation";

export interface AuthUser {
  username: string;
  name: string;
  /** P0-5: set while the account still carries its provisioning password. */
  mustChangePassword?: boolean;
}

/**
 * `loading` means a token is in storage and has not been checked yet -- the
 * guard must not bounce someone to the login page on a slow first paint only
 * to have them land back here a moment later.
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  activeOrganizationId?: string | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refetchSession?: () => Promise<void>;
}

/** localStorage throws in a sandboxed iframe; auth must degrade, not crash. */
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // better-auth owns the session: it holds the token, refreshes it, and is the
  // only thing that can say whether it is still good. The page asks it rather
  // than reading storage and asking the server separately.
  const { data, isPending, refetch } = authClient.useSession();

  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    if (isPending) {
      setStatus("loading");

      return;
    }

    setStatus(data?.user ? "authenticated" : "anonymous");
  }, [data, isPending]);

  const user: AuthUser | null = data?.user
    ? {
        name: data.user.name ?? "",
        username: data.user.email,
        // SAFETY: better-auth user record carries optional custom provisioning flags
        mustChangePassword:
          (data.user as { mustChangePassword?: boolean }).mustChangePassword ??
          false,
      }
    : null;

  // SAFETY: better-auth session carries activeOrganizationId
  const activeOrganizationId =
    (data?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null;

  useEffect(() => {
    if (status !== "authenticated" || !activeOrganizationId) return;

    return startTenantMutationStream(activeOrganizationId);
  }, [status, activeOrganizationId]);

  const login = useCallback(async (username: string, password: string) => {
    const { error, data: body } = await authClient.signIn.email({
      email: username,
      password,
    });

    if (error) {
      throw new Error(error.message ?? "Invalid username or password");
    }

    const signedIn = body?.user;

    if (!signedIn) {
      throw new Error("Invalid username or password");
    }

    resetUnauthorizedRedirect();

    return { name: signedIn.name ?? "", username: signedIn.email };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      /* the session is gone server-side or not; the client drops it either way */
    }
  }, []);

  const refetchSession = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({
      user,
      status,
      activeOrganizationId,
      login,
      logout,
      refetchSession,
    }),
    [user, status, activeOrganizationId, login, logout, refetchSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return context;
}
