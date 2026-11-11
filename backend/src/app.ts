import express from "express";
import cors from "cors";
import { pool } from "./db/pool";
import { requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errors";
import { authRouter } from "./routes/auth";
import { patternsRouter } from "./routes/patterns";
import { problemsRouter } from "./routes/problems";
import { queueRouter } from "./routes/queue";
import { reviewsRouter } from "./routes/reviews";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.use("/auth", authRouter);
app.use("/patterns", requireAuth, patternsRouter);
app.use("/problems", requireAuth, problemsRouter);
app.use("/queue", requireAuth, queueRouter);
app.use("/reviews", requireAuth, reviewsRouter);

app.use(notFound);
app.use(errorHandler);
