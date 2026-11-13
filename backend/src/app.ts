import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pool } from "./db/pool";
import { requireAuth } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errors";
import { authRouter } from "./routes/auth";
import { cardsRouter } from "./routes/cards";
import { importRouter } from "./routes/import";
import { patternsRouter } from "./routes/patterns";
import { problemsRouter } from "./routes/problems";
import { queueRouter } from "./routes/queue";
import { reviewsRouter } from "./routes/reviews";
import { statsRouter } from "./routes/stats";

export const app = express();

// Render and similar hosts put a proxy in front of the app. Without this,
// every request looks like it comes from the proxy's IP and rate limiting breaks.
app.set("trust proxy", 1);

// CORS_ORIGIN is a comma-separated list of allowed frontend URLs.
// Unset (local development) means open, because the dev proxy is used anyway.
const origins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors(origins.length > 0 ? { origin: origins } : undefined));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30, // attempts per IP per 15 minutes
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
  skip: () => process.env.NODE_ENV === "test", // the test suite registers many users
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.use("/auth", authLimiter, authRouter);
app.use("/patterns", requireAuth, patternsRouter);
app.use("/problems", requireAuth, problemsRouter);
app.use("/cards", requireAuth, cardsRouter);
app.use("/queue", requireAuth, queueRouter);
app.use("/reviews", requireAuth, reviewsRouter);
app.use("/stats", requireAuth, statsRouter);
app.use("/import", requireAuth, importRouter);

app.use(notFound);
app.use(errorHandler);
