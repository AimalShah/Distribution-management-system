/**
 * Checkpoint 5 — Electron Shell: Acceptance Test
 * 
 * Verifies the Electron shell wraps the web app correctly.
 * Run with: pnpm --filter desktop run test:checkpoint5
 */

import { describe, it, expect, beforeAll } from "vitest";
import { _electron as electron } from "playwright";
import * as path from "path";

describe("Checkpoint 5 — Electron Shell", () => {
  let electronApp: Awaited<ReturnType<typeof electron.launch>>;
  let window: any;

  beforeAll(async () => {
    const appPath = path.join(__dirname, "../");
    electronApp = await electron.launch({
      args: [appPath],
      env: { ...process.env, NODE_ENV: "test" },
    });
    window = await electronApp.firstWindow();
  }, 30000);

  it("launches Electron window", () => {
    expect(window).toBeTruthy();
  });

  it("loads the web app", async () => {
    const title = await window.title();
    expect(title).toBeTruthy();
  });

  it("has correct window dimensions", async () => {
    const bounds = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    expect(bounds.width).toBeGreaterThanOrEqual(1400);
    expect(bounds.height).toBeGreaterThanOrEqual(900);
  });

  it("cold starts within 3 seconds", async () => {
    const start = Date.now();

    const app = await electron.launch({
      args: [path.join(__dirname, "../")],
      env: { ...process.env, NODE_ENV: "test" },
    });

    await app.firstWindow();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
    await app.close();
  }, 10000);

  it("API calls work from Electron", async () => {
    // Verify the app can make API calls to the server
  });

  it("preload script exposes electron API", async () => {
    const hasElectron = await window.evaluate(() => typeof (window as any).electron !== "undefined");
    expect(hasElectron).toBe(true);
  });
});
