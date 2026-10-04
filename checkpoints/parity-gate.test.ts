/**
 * The gate has to be total.
 *
 * A parity suite that is neither `gated` nor listed in `GATE` as `pending`
 * would never run and never fail, which is the exact failure mode that let the
 * original CI job report success while executing nothing. So this test fails
 * when a checkpoint directory containing a `parity.test.ts` has no entry, and
 * when an entry claims a status it does not have.
 *
 * This file is included by both parity configs unconditionally and is not
 * itself listed in the gate -- it is the one suite that must run before any
 * decision about the others.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { GATE, GATED_DIRS, PENDING_DIRS, parityTestGlobs } from "./parity-gate";

const root = path.resolve(__dirname, "..");
const checkpointsDir = path.join(root, "checkpoints");

const toPosix = (p: string) => p.split(path.sep).join("/");

/** Every `parity.test.ts` under `checkpoints/`, as a repo-relative POSIX path. */
function findParityTests(dir: string = checkpointsDir): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findParityTests(full));
    } else if (entry.name === "parity.test.ts") {
      found.push(toPosix(path.relative(root, full)));
    }
  }
  return found.sort();
}

/** The checkpoint directory a test belongs to, e.g. `checkpoints/02-express-api`. */
function owningDir(testPath: string): string {
  const parts = testPath.split("/"); // checkpoints/<dir>[/<subdir>]/parity.test.ts
  return parts[1];
}

describe("checkpoint parity gate", () => {
  const parityTests = findParityTests();
  const checkpointDirs = fs
    .readdirSync(checkpointsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  it("finds the parity suites on disk", () => {
    // A glob that silently matches nothing is what made the old job useless,
    // so assert on discovery rather than trusting the pattern.
    expect(parityTests.length).toBeGreaterThan(0);
  });

  it("gives every parity suite a gate decision", () => {
    const orphans = [
      ...new Set(
        parityTests
          .map(owningDir)
          .filter((dir) => !GATED_DIRS.includes(dir) && !PENDING_DIRS.includes(dir))
      ),
    ].sort();

    expect(
      orphans,
      `These checkpoints have a parity suite but no entry in checkpoints/parity-gate.ts: ${orphans.join(
        ", "
      )}. Add an entry with status "gated" (and make it pass) or "pending" (with a reason).`
    ).toEqual([]);
  });

  it("gives every gate entry a reason when pending", () => {
    const unexplained = GATE.filter(
      (e) => e.status === "pending" && !e.reason?.trim()
    ).map((e) => e.dir);

    expect(
      unexplained,
      `Pending entries without a reason: ${unexplained.join(", ")}`
    ).toEqual([]);
  });

  it("points every gate entry at a real checkpoint directory", () => {
    const missing = GATE.map((e) => e.dir).filter((d) => !checkpointDirs.includes(d));

    expect(missing, `Gate entries with no directory: ${missing.join(", ")}`).toEqual([]);
  });

  it("actually matches the gated suites on disk", () => {
    // The globs are the contract between the gate and the runner. If a glob
    // stops matching -- a renamed file, a moved directory -- the job goes green
    // without testing anything, which is the failure this whole file exists to
    // prevent.
    for (const dir of GATED_DIRS) {
      const matches = parityTests.filter(
        (t) => owningDir(t) === dir
      );
      expect(
        matches.length,
        `"${dir}" is gated but ${parityTestGlobs()
          .filter((g) => g.includes(dir))
          .join(", ")} matched no parity suite`
      ).toBeGreaterThan(0);
    }
  });
});
