import { PrismaClient } from "../prisma/generated/client";
import { trackQuery } from "./debug-log";

const baseClient = new PrismaClient();

const shouldTrack = process.env.NODE_ENV !== "production";

export const prisma = baseClient.$extends({
  name: "dms-query-log",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!shouldTrack) return query(args);

        const start = Date.now();

        try {
          return await query(args);
        } finally {
          trackQuery({
            model,
            action: operation,
            ms: Date.now() - start,
            at: new Date().toISOString(),
          });
        }
      },
    },
  },
});

export default prisma;
