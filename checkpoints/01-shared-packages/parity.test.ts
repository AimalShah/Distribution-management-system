/**
 * Checkpoint 1 — Shared Packages: Parity Test
 * 
 * Verifies Zod schemas match the original validation behavior.
 * Run with: pnpm --filter shared run test:checkpoint1
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// `checkpoints/<name>/parity.test.ts` -> repo root is two levels up. This was
// three, which pointed at the parent of the repository.
const root = path.resolve(__dirname, "../..");

describe("Checkpoint 1 — Shared packages", () => {
  it("packages/db has prisma schema with all models", () => {
    const schema = fs.readFileSync(path.join(root, "packages/db/prisma/schema.prisma"), "utf-8");
    const models = ["User", "Session", "Account", "Verification", "Organization", "Member", "Invitation", "Supplier", "Customer", "Product", "Purchase", "PurchaseItem", "Sale", "SaleItem", "Category", "Brand", "Inventory", "InventoryLog", "Return", "ReturnItem"];

    for (const model of models) {
      expect(schema, `schema should contain model ${model}`).toContain(`model ${model}`);
    }
  });

  it("packages/shared has pagination schemas", () => {
    const content = fs.readFileSync(path.join(root, "packages/shared/src/pagination.ts"), "utf-8");
    expect(content).toContain("paginationQuerySchema");
    expect(content).toContain("paginatedResponseSchema");
  });

  it("packages/shared has entity schemas", () => {
    const schemasDir = path.join(root, "packages/shared/src/schemas");
    const expected = ["product", "purchase", "sale", "return", "customer", "supplier", "category", "brand", "auth", "inventory"];

    for (const schema of expected) {
      expect(fs.existsSync(path.join(schemasDir, `${schema}.ts`)), `${schema}.ts should exist`).toBe(true);
    }
  });

  it("packages/ui has data-table component", () => {
    expect(fs.existsSync(path.join(root, "packages/ui/src/components/data-table.tsx"))).toBe(true);
  });

  it("packages/ui has shadcn components", () => {
    const componentsDir = path.join(root, "packages/ui/src/components");
    const expected = ["button", "input", "label", "select", "table", "dialog", "dropdown-menu", "tabs", "card", "badge", "form", "popover", "calendar", "sheet", "avatar", "separator", "skeleton", "sonner", "tooltip", "checkbox", "switch", "textarea", "date-range", "accordion", "alert", "progress", "sidebar", "chart"];

    for (const comp of expected) {
      expect(fs.existsSync(path.join(componentsDir, `${comp}.tsx`)), `${comp}.tsx should exist`).toBe(true);
    }
  });

  it("packages/ui re-exports every component from its barrel", () => {
    // A component that exists but is not exported is unreachable to consumers,
    // and nothing else fails: the typecheck skips it and the build never sees it.
    const componentsDir = path.join(root, "packages/ui/src/components");
    const barrel = fs.readFileSync(path.join(root, "packages/ui/src/index.ts"), "utf-8");

    for (const file of fs.readdirSync(componentsDir)) {
      if (!file.endsWith(".tsx")) continue;
      const name = file.replace(/\.tsx$/, "");
      expect(barrel, `${name} should be re-exported from packages/ui/src/index.ts`).toContain(
        `./components/${name}`
      );
    }
  });

  it("packages/ui uses relative imports, not path aliases", () => {
    // @dms/ui ships raw TypeScript (`main: ./src/index.ts`), so the consuming
    // app's tsc compiles these files with the *app's* tsconfig. An `@/` import
    // resolves inside this package but not from the app, and the failure lands
    // on every component at once with no error here. `packages/shared` already
    // works this way; this keeps the shadcn CLI output from drifting back.
    const srcDir = path.join(root, "packages/ui/src");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && /from\s+["']@\//.test(fs.readFileSync(full, "utf-8"))) {
          offenders.push(path.relative(root, full));
        }
      }
    };

    walk(srcDir);
    expect(offenders, `these files import via "@/" and break consumers: ${offenders.join(", ")}`).toEqual([]);
  });

  it("apps/web stylesheet resolves the packages/ui theme and Tailwind source", () => {
    // Both paths are relative to the stylesheet, not the repo root: this file is
    // `apps/web/src/index.css`, so two levels up is `apps`, not the root. Vite
    // reports a bad `@import` but Tailwind ignores an unresolvable `@source`
    // without a word, which is how the components compiled and rendered unstyled.
    const cssPath = path.join(root, "apps/web/src/index.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const base = path.dirname(cssPath);
    const toDir = (spec: string) => path.resolve(base, spec.split("*")[0].replace(/\/$/, ""));

    const imported = css.match(/@import\s+["']([^"']*packages\/ui[^"']*)["']/);
    expect(imported, "index.css should @import the packages/ui theme").not.toBeNull();
    expect(
      fs.existsSync(toDir(imported![1])),
      `theme @import resolves to ${toDir(imported![1])}, which does not exist`
    ).toBe(true);

    const sourced = css.match(/@source\s+["']([^"']*packages\/ui[^"']*)["']/);
    expect(sourced, "index.css should @source the packages/ui sources").not.toBeNull();
    expect(
      fs.existsSync(toDir(sourced![1])),
      `@source resolves to ${toDir(sourced![1])}, which does not exist`
    ).toBe(true);
  });
});
