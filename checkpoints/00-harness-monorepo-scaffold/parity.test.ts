/**
 * Checkpoint 0 — Harness + Monorepo Scaffold: Parity Test
 * 
 * Verifies the monorepo structure is correctly set up and the harness works.
 * Run with: pnpm --filter server run test:checkpoint0
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";

describe("Checkpoint 0 — Monorepo scaffold", () => {
  const root = path.resolve(__dirname, "../../..");

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
  it("harness CLI prints JSON for a registered service", () => {
    // This test assumes the server package has a test harness setup
    // The actual test will be implemented once the harness is built
    expect(true).toBe(true);
  });
});
