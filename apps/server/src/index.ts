// Must stay first: it writes `process.env`, and every import below this line
// reads it at module scope (`config/env`) or on first query (`@dms/db`).
import "./config/dev-env";
import { createApp } from "./app";
import { assertAuthIsSafe, host, port } from "./config/env";

assertAuthIsSafe();

const app = createApp();

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});

export { app };
