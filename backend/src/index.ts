import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db/pool";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to PrepDepth API",
    status: "running"
  });
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

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`PrepDebt API running on http://localhost:${port}`);
});
