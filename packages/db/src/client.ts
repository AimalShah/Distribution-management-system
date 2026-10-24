import { PrismaClient } from "../prisma/generated/client";
import { trackQuery } from "./debug-log";

const transactionTimeout =
  Number(process.env.PRISMA_TRANSACTION_TIMEOUT) > 0
    ? Number(process.env.PRISMA_TRANSACTION_TIMEOUT)
    : 30000;

const transactionMaxWait =
  Number(process.env.PRISMA_TRANSACTION_MAX_WAIT) > 0
    ? Number(process.env.PRISMA_TRANSACTION_MAX_WAIT)
    : 10000;

const baseClient = new PrismaClient({
  transactionOptions: {
    maxWait: transactionMaxWait,
    timeout: transactionTimeout,
  },
});

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
