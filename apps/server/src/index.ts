import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== "production") {
  import("./routes/__debug").then(({ debugRouter }) => {
    app.use("/__debug", debugRouter);
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app };
