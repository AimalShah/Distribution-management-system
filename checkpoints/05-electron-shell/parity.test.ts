/**
 * Checkpoint 5 — Electron Shell: Parity Test
 *
 * Verifies the Electron shell packaging, security settings, build output,
 * and IPC bridge match the architectural contract without requiring a GUI display.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../..");
const desktopDir = path.join(root, "apps/desktop");

describe("Checkpoint 5 — Electron Shell: Package & Config", () => {
  it("has apps/desktop/package.json with correct scripts and dependencies", () => {
    const pkgPath = path.join(desktopDir, "package.json");
    expect(fs.existsSync(pkgPath), "desktop package.json must exist").toBe(true);

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.name).toBe("@dms/desktop");
    expect(pkg.main).toBe("dist/main.js");

    expect(pkg.scripts.build).toBe("tsc");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    expect(pkg.scripts.dev).toContain("electron .");
    expect(pkg.scripts.dist).toContain("electron-builder");

    expect(pkg.dependencies).toHaveProperty("@dms/web");
    expect(pkg.devDependencies).toHaveProperty("electron");
    expect(pkg.devDependencies).toHaveProperty("electron-builder");
  });

  it("has electron-builder.yml configured for multi-platform distribution", () => {
    const builderPath = path.join(desktopDir, "electron-builder.yml");
    expect(fs.existsSync(builderPath), "electron-builder.yml must exist").toBe(true);

    const content = fs.readFileSync(builderPath, "utf-8");
    expect(content).toContain("appId: com.inventioo.dms");
    expect(content).toContain("productName: Inventioo DMS");
    expect(content).toContain("output: release");
    expect(content).toContain("win:");
    expect(content).toContain("mac:");
    expect(content).toContain("linux:");
  });

  it("has tsconfig.json emitting CommonJS for electron main process", () => {
    const tsconfigPath = path.join(desktopDir, "tsconfig.json");
    expect(fs.existsSync(tsconfigPath), "tsconfig.json must exist").toBe(true);

    const content = fs.readFileSync(tsconfigPath, "utf-8");
    expect(content).toContain('"extends": "@dms/config-typescript/base.json"');
    expect(content).toContain('"outDir": "dist"');
    expect(content).toContain('"module": "commonjs"');
  });
});

describe("Checkpoint 5 — Electron Shell: Security & Architecture", () => {
  const mainSource = fs.readFileSync(path.join(desktopDir, "src/main.ts"), "utf-8");
  const preloadSource = fs.readFileSync(path.join(desktopDir, "src/preload.ts"), "utf-8");

  it("enforces contextIsolation: true and nodeIntegration: false", () => {
    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("nodeIntegration: false");
  });

  it("configures standard desktop window dimensions (1400x900)", () => {
    expect(mainSource).toContain("width: 1400");
    expect(mainSource).toContain("height: 900");
  });

  it("loads preload script from the same directory", () => {
    expect(mainSource).toMatch(/preload:\s*path\.join\(__dirname,\s*["']preload\.js["']\)/);
  });

  it("switches cleanly between dev server and built web app", () => {
    expect(mainSource).toContain("http://localhost:5173");
    expect(mainSource).toContain("../../web/dist");
    expect(mainSource).toContain("index.html");
  });

  it("exposes a guarded electron API on window without raw node globals", () => {
    expect(preloadSource).toContain('contextBridge.exposeInMainWorld("electron"');
    expect(preloadSource).toContain("platform: process.platform");
    expect(preloadSource).toContain("versions:");
    expect(preloadSource).toContain("app:version");
    expect(preloadSource).toContain("app:quit");
    expect(preloadSource).toContain("Invalid IPC channel");
  });
});

describe("Checkpoint 5 — Electron Shell: Build Output", () => {
  it("compiles main.ts and preload.ts into dist/", () => {
    const mainDist = path.join(desktopDir, "dist/main.js");
    const preloadDist = path.join(desktopDir, "dist/preload.js");

    expect(fs.existsSync(mainDist), "dist/main.js must exist").toBe(true);
    expect(fs.existsSync(preloadDist), "dist/preload.js must exist").toBe(true);

    const mainContent = fs.readFileSync(mainDist, "utf-8");
    const preloadContent = fs.readFileSync(preloadDist, "utf-8");

    expect(mainContent).toContain("contextIsolation: true");
    expect(mainContent).toContain("nodeIntegration: false");
    expect(preloadContent).toContain("exposeInMainWorld");
  });
});
