// Must stay first: it writes `process.env`, and every import below this line
// reads it at module scope (`config/env`) or on first query (`@dms/db`).
import "./config/dev-env";
import { createApp } from "./app";
import { assertAuthIsSafe, host, port } from "./config/env";
import { logger } from "./logger";

assertAuthIsSafe();

const app = createApp();

app.listen(port, host, () => {
  logger.info({ event: "server_started", host, port }, "server started");
});

export { app };
