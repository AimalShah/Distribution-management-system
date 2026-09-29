export type QueryLogEntry = { model: string; action: string; ms: number; at: string };
const recentQueries: QueryLogEntry[] = [];

export function trackQuery(entry: QueryLogEntry) {
  recentQueries.push(entry);
  if (recentQueries.length > 200) recentQueries.shift();
}
export function getRecentQueries() {
  return recentQueries;
}
