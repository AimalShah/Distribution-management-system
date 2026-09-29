import { PrismaClient } from "@prisma/client";
import { trackQuery } from "./debug-log";

const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  if (process.env.NODE_ENV !== "production") {
    trackQuery({
      model: params.model ?? "raw",
      action: params.action,
      ms: Date.now() - start,
      at: new Date().toISOString(),
    });
  }
  return result;
});

export default prisma;
export * from "@prisma/client";
