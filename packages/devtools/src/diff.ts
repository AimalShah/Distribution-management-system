import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const CHECKPOINTS_DIR = path.resolve(__dirname, "../../../checkpoints");

function normalize(html: string) {
  return html
    .replace(/id="[a-zA-Z0-9_-]{8,}"/g, 'id="[ID]"')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "[TIMESTAMP]");
}

export async function diffCheckpoint(name: string) {
  const dir = path.join(CHECKPOINTS_DIR, name);
  const result: { pass: boolean; details: string[] } = { pass: true, details: [] };

  const beforeDom = path.join(dir, "before", "render.json");
  const afterDom = path.join(dir, "after", "render.json");

  if (fs.existsSync(beforeDom) && fs.existsSync(afterDom)) {
    const before = JSON.parse(fs.readFileSync(beforeDom, "utf8"));
    const after = JSON.parse(fs.readFileSync(afterDom, "utf8"));

    if (normalize(before.dom) !== normalize(after.dom)) {
      result.pass = false;
      result.details.push("DOM structure differs (after normalizing generated IDs/timestamps)");
    }
  }

  const beforePng = path.join(dir, "before", "screenshot.png");
  const afterPng = path.join(dir, "after", "screenshot.png");

  if (fs.existsSync(beforePng) && fs.existsSync(afterPng)) {
    const img1 = PNG.sync.read(fs.readFileSync(beforePng));
    const img2 = PNG.sync.read(fs.readFileSync(afterPng));
    const diffImg = new PNG({ width: img1.width, height: img1.height });

    const diffPixels = pixelmatch(
      img1.data, img2.data, diffImg.data, img1.width, img1.height, { threshold: 0.1 }
    );

    const diffRatio = diffPixels / (img1.width * img1.height);
    fs.writeFileSync(path.join(dir, "diff.png"), PNG.sync.write(diffImg));

    if (diffRatio > 0.02) {
      result.pass = false;
      result.details.push(`Screenshot differs by ${(diffRatio * 100).toFixed(1)}% of pixels — see diff.png`);
    }
  }

  return result;
}
