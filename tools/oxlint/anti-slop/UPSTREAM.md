# UPSTREAM — anti-slop Oxlint plugin (vendored)

## Source

- Source repository: <https://github.com/dmmulroy/anti-slop>
- Source commit: **unknown.** The install records (`~/.agents/.skill-lock.json`) capture a skill folder hash, not an upstream commit, and no upstream tag/commit is recorded alongside the assets. Not guessed.
- Recoverable pristine snapshot: `/home/aimalshah/.agents/skills/install-anti-slop/assets/anti-slop`, installed `2026-10-07T22:35:37.345Z` from `dmmulroy/anti-slop`, `skillFolderHash: 89044d21c75a367eac1ddbaf208e650b1a7d5820`.
- Installed by the `install-anti-slop` agent skill (`/home/aimalshah/.agents/skills/install-anti-slop`) on 2026-10-08 via its `scripts/install.mjs`.

### Integrity of the copied assets

Verified with `diff -r` against the pristine snapshot: identical, with one intentional addition — this file (`UPSTREAM.md`), which the snapshot does not carry.

Combined digest of the installed tree at install time (sorted `sha256sum` of every file under `tools/oxlint/anti-slop`, piped through `sha256sum`), excluding this file:

```
c5255401fb1b6bcda057ec8a0f29eced8f3180b55d2d6c5a6904fad799fb9585
```

## Installed paths

- Entry point: `tools/oxlint/anti-slop/index.ts`
- Generic rules: `tools/oxlint/anti-slop/rules/`, `tools/oxlint/anti-slop/shared/`
- Opt-in Effect rules (present, **not registered**): `tools/oxlint/anti-slop/effect/`
- Vendored third-party: `tools/oxlint/anti-slop/vendor/eslint-stylistic/` — see its own `UPSTREAM.md` (ESLint Stylistic commit `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`) and `LICENSE`; both are retained verbatim.

## Registration and dependencies

- Config: `oxlint.config.mts` (repo root) — `jsPlugins` entry `anti-slop` → `./tools/oxlint/anti-slop/index.ts`; all generic `anti-slop/*` rules plus `oxc/no-accumulating-spread` set to `error`.
- Dependencies added (root devDependencies, pinned to the same version so they upgrade together): `oxlint@1.87.0`, `@oxlint/plugins@1.87.0`.
- `oxlint.config.ts` was renamed to `oxlint.config.mts` so Node treats it as ESM without a root `"type": "module"` change.

## Intentional deviations from the pristine copy

1. `tools/oxlint/anti-slop/UPSTREAM.md` added (this file).
2. `tools/package.json` (`{"type": "module"}`, `@dms/oxlint-tools`) added outside the vendored directory so Node loads `tools/oxlint/anti-slop/index.ts` as ESM without emitting `MODULE_TYPELESS_PACKAGE_JSON` warnings; the vendored tree itself is unchanged.
3. Effect plugin **not** registered: `effect` is not a direct dependency of any workspace `package.json`.
4. Ignore patterns include the required agent-tooling directories plus `.turbo/**` and `**/dist/**` (generated build output).
