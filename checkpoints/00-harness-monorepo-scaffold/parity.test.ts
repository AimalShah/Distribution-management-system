/**
 * Checkpoint 0 — Harness + Monorepo Scaffold: Parity Test
 * 
 * Verifies the monorepo structure is correctly set up and the harness works.
 * Run with: pnpm --filter server run test:checkpoint0
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Module scope, not inside a `describe`: two `describe` blocks below use it.
// This file is `checkpoints/<name>/parity.test.ts`, so the repo root is two
// levels up. It was written as three, which resolved to the *parent* of the
// repository -- so every `path.join(root, ...)` read a directory that does not
// exist and the assertions were passing or failing for the wrong reason.
const root = path.resolve(__dirname, "../..");

describe("Checkpoint 0 — Monorepo scaffold", () => {
  it("has pnpm-workspace.yaml with correct packages", () => {
    const content = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf-8");
    expect(content).toContain("apps/*");
    expect(content).toContain("packages/*");
  });

  it("has turbo.json with required tasks", () => {
    const content = fs.readFileSync(path.join(root, "turbo.json"), "utf-8");
    expect(content).toContain('"build"');
    expect(content).toContain('"dev"');
    expect(content).toContain('"lint"');
  });

  it("has all required directories", () => {
    const dirs = [
      "apps/web",
      "apps/server",
      "apps/desktop",
      "packages/ui",
      "packages/db",
      "packages/shared",
      "packages/config-eslint",
      "packages/config-typescript",
    ];

    for (const dir of dirs) {
      expect(fs.existsSync(path.join(root, dir)), `${dir} should exist`).toBe(true);
    }
  });

  it("packages/db has prisma schema", () => {
    const schemaPath = path.join(root, "packages/db/prisma/schema.prisma");
    expect(fs.existsSync(schemaPath)).toBe(true);
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("model User");
    expect(content).toContain("model Product");
    expect(content).toContain("model Organization");
  });

  it("packages/shared has pagination schemas", () => {
    const paginationPath = path.join(root, "packages/shared/src/pagination.ts");
    expect(fs.existsSync(paginationPath)).toBe(true);
  });

  it("apps/web has vite config", () => {
    expect(fs.existsSync(path.join(root, "apps/web/vite.config.ts"))).toBe(true);
  });

  it("apps/server has harness router", () => {
    expect(fs.existsSync(path.join(root, "apps/server/src/harness/router.ts"))).toBe(true);
  });

  it("apps/desktop has electron main", () => {
    expect(fs.existsSync(path.join(root, "apps/desktop/src/main.ts"))).toBe(true);
  });
});

describe("Checkpoint 0 — Harness", () => {
  const harnessPath = path.resolve(root, "apps/server/src/harness/router.ts");

  it("harness router exposes the documented endpoints", () => {
    // The plan specifies `GET /__debug/state` and `POST /__debug/call`. Asserting
    // on the source is the honest check here: the harness mounts only in dev and
    // reaches `@dms/db`, so a supertest run needs a live database, which this
    // parity test cannot assume. The endpoint behaviour itself is covered by
    // `apps/server/src/harness/router.test.ts`, which runs in the server suite.
    const source = fs.readFileSync(harnessPath, "utf-8");
    expect(source).toContain('harnessRouter.get("/state"');
    expect(source).toContain('harnessRouter.post("/call"');
  });

  it("routes/__debug.ts is a re-export, not a second implementation", () => {
    // Two implementations of the same endpoints would drift. The mount site keeps
    // the `debugRouter` name; the contract lives in one module.
    const source = fs.readFileSync(
      path.join(root, "apps/server/src/routes/__debug.ts"),
      "utf-8"
    );

    expect(source).toMatch(/export \{ harnessRouter as debugRouter \}/);
  });

  it("the harness CLI is wired to a runnable script", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8")
    );

    expect(pkg.scripts.debug).toContain("packages/devtools/src/cli.ts");
  });
});
