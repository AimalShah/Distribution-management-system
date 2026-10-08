import { callService } from "./service-call";
import { dumpDebugState } from "./debug-state-client";
import { renderHeadless } from "./render-headless";
import { fetchRenderedHtml } from "./fetch-html";
import { captureScreenshot } from "./screenshot";
import { diffCheckpoint } from "./diff";
import fs from "node:fs/promises";

async function main() {
  const [, , cmd, ...rest] = process.argv;

  switch (cmd) {
    case "call": {
      console.log(JSON.stringify(await callService(rest[0], rest[1]), null, 2));
      break;
    }

    case "state": {
      console.log(JSON.stringify(await dumpDebugState(), null, 2));
      break;
    }

    case "render": {
      const mode = rest.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "component";
      const positional = rest.filter((a) => !a.startsWith("--"));
      const [target, propsOrOut, out] = positional;

      const dump =
        mode === "fetch"
          ? await fetchRenderedHtml(target)
          : await renderHeadless(target, propsOrOut ? JSON.parse(propsOrOut) : {});

      const outFile = mode === "fetch" ? propsOrOut : out;

      if (outFile) await fs.writeFile(outFile, JSON.stringify(dump, null, 2));
      else console.log(JSON.stringify(dump, null, 2));
      break;
    }

    case "screenshot": {
      const [url, outFile] = rest;
      await captureScreenshot(url, outFile);
      console.log(`Saved ${outFile}`);
      break;
    }

    case "diff": {
      const result = await diffCheckpoint(rest[0]);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.pass ? 0 : 1);
    }

    default:
      console.error("Usage: debug <call|state|render|screenshot|diff> ...");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
