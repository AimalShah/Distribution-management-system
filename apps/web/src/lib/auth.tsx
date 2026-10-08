import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

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
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = "auth_token";

/**
 * What the server accepts before anyone has touched `DMS_AUTH_USERNAME` /
 * `DMS_AUTH_PASSWORD`. Shown on the login page so a first run needs no
 * read-through of the env docs to get in.
 */
export const DEFAULT_CREDENTIALS = {
  username: "admin",
  password: "admin123",
} as const;

/** localStorage throws in a sandboxed iframe; auth must degrade, not crash. */
const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to do: the token simply will not persist */
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [status, setStatus] = useState<AuthStatus>(() =>
    readToken() ? "loading" : "anonymous"
  );

  // A stored token is a claim, not a fact. `/auth/me` is what makes it one, and
  // an expired or tampered token has to end the session here rather than
  // leaving the UI to render on top of a session the server will reject.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setStatus("anonymous");

      return;
    }

    let cancelled = false;
    api
      .get("/auth/me")
      .then((body) => {
        if (cancelled) return;
        setUser(body.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        writeToken(null);
        setToken(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const body = await api.post("/auth/login", { username, password });
    const nextUser: AuthUser = body.user;

    writeToken(body.token);
    setUser(nextUser);
    setToken(body.token);
    setStatus("authenticated");

    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* the token is dropped either way */
    }

    writeToken(null);
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout]
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
