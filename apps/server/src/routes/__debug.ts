import { Router } from "express";
import { getRecentQueries } from "@dms/db/debug-log";

export const debugRouter: Router = Router();

debugRouter.get("/state", (_req, res) => {
  const queries = getRecentQueries();
  res.json({
    recentQueries: queries.slice(-50),
    queryCountLastMinute: queries.filter(
      (q) => Date.now() - new Date(q.at).getTime() < 60_000
    ).length,
  });
});

debugRouter.post("/call", async (req, res) => {
  const { service, fn, args } = req.body;
  try {
    const mod = await import(`../services/${service}`);
    res.json({ success: true, result: await mod[fn](...(Array.isArray(args) ? args : [args])) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
