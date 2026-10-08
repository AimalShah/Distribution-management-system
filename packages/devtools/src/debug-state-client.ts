export async function dumpDebugState(baseUrl = "http://localhost:4000") {
  const res = await fetch(`${baseUrl}/__debug/state`);

  if (!res.ok) throw new Error(`Debug endpoint returned ${res.status}`);

  return res.json();
}
