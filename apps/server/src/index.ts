import { createApp } from "./app";
import { assertAuthShimIsSafe, host, port } from "./config/env";

assertAuthShimIsSafe();

const app = createApp();

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});

export { app };
