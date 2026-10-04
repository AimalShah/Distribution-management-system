import { createApp } from "./app";
import { assertAuthIsSafe, host, port } from "./config/env";

assertAuthIsSafe();

const app = createApp();

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});

export { app };
