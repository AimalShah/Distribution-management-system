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

export interface AuthUser {
  username: string;
  name: string;
}

/**
 * `loading` means a token is in storage and has not been checked yet -- the
 * guard must not bounce someone to the login page on a slow first paint only
 * to have them land back here a moment later.
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  activeOrganizationId?: string | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

/**
 * The operator the seed creates, shown on the login page so a first run needs
 * no read-through of the env docs to get in. `username` is the account's email
 * address: better-auth signs in by email, so the field that used to be called a
 * username is one.
 */
export const DEFAULT_CREDENTIALS = {
  username: "owner@test.com",
  password: "admin123",
} as const;

/** localStorage throws in a sandboxed iframe; auth must degrade, not crash. */
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // better-auth owns the session: it holds the token, refreshes it, and is the
  // only thing that can say whether it is still good. The page asks it rather
  // than reading storage and asking the server separately.
  const { data, isPending } = authClient.useSession();

  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    if (isPending) {
      setStatus("loading");

      return;
    }

    setStatus(data?.user ? "authenticated" : "anonymous");
  }, [data, isPending]);

  const user: AuthUser | null = data?.user
    ? { name: data.user.name ?? "", username: data.user.email }
    : null;

  const activeOrganizationId =
    (data?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null;

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

    return { name: signedIn.name ?? "", username: signedIn.email };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch {
      /* the session is gone server-side or not; the client drops it either way */
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, activeOrganizationId, login, logout }),
    [user, status, activeOrganizationId, login, logout]
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
