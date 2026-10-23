// Where the first owner's password comes from, and when the scripts refuse to
// run at all.
//
// A seeded owner whose password is a well-known literal is an open console: the
// whole commit history is public evidence of what to type. So the password must
// come from the environment for any database a stranger could reach, and the
// known literal survives only for databases on the developer's own machine,
// where that trade-off is made on purpose.
import "./load-env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const databaseHost = () => {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) return null;

  try {
    return new URL(url).hostname || null;
  } catch {
    return null; // Not a URL: treat as an opaque, non-local target.
  }
};

const isLocalDatabase = () => {
  const host = databaseHost();

  return host !== null && LOCAL_HOSTS.has(host);
};

export interface OwnerPasswordResolution {
  password: string;
  /** `env` when it came from DMS_OWNER_PASSWORD; secrets from there are never echoed. */
  source: "env" | "local-dev";
}

export function resolveOwnerPassword(): OwnerPasswordResolution {
  const fromEnv = process.env.DMS_OWNER_PASSWORD?.trim() ?? "";

  if (fromEnv) {
    if (fromEnv.toLowerCase() === "admin123") {
      throw new Error(
        "DMS_OWNER_PASSWORD is the well-known default 'admin123', which a seeded " +
          "database would expose to anyone. Choose a password nobody can read out " +
          "of this repository."
      );
    }

    return { password: fromEnv, source: "env" };
  }

  if (!isLocalDatabase()) {
    throw new Error(
      "DMS_OWNER_PASSWORD is not set and the database is not on this machine. " +
        "Seeding a well-known owner password against a hosted database would hand " +
        "over the console. Set DMS_OWNER_PASSWORD before running this script " +
        "(local localhost databases keep the dev convenience automatically)."
    );
  }

  return { password: "admin123", source: "local-dev" };
}

/** A password from the environment must not be echoed back into a terminal. */
export function describeOwnerPassword(resolution: OwnerPasswordResolution): string {
  return resolution.source === "env"
    ? "(set from DMS_OWNER_PASSWORD — not shown)"
    : `${resolution.password} (local-dev default — do not use on a hosted database)`;
}
