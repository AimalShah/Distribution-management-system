import path from "node:path";
import { pathToFileURL } from "node:url";

const SERVICES_DIR = path.resolve(__dirname, "../../../apps/server/src/services");

export async function callService(target: string, argsJson?: string) {
  const [serviceName, fnName] = target.split(".");
  if (!serviceName || !fnName) {
    throw new Error(`Expected "<service>.<function>", got "${target}"`);
  }

  const modulePath = path.join(SERVICES_DIR, `${serviceName}.ts`);
  const mod = await import(pathToFileURL(modulePath).href);
  const fn = mod[fnName];
  if (typeof fn !== "function") {
    throw new Error(`${serviceName}.ts has no exported function "${fnName}"`);
  }

  const args = argsJson ? JSON.parse(argsJson) : [];
  return fn(...(Array.isArray(args) ? args : [args]));
}
