import { Router } from "express";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";

export const patternsRouter = Router();

patternsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      "SELECT id::int AS id, name, description FROM patterns ORDER BY name"
    );
    res.json(result.rows);
  })
);
