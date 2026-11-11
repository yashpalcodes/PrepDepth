import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errors";
import { signToken } from "../middleware/auth";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const hash = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id::int AS id, email",
        [email, hash]
      );
      const user = result.rows[0];
      res.status(201).json({ token: signToken(user.id), user });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new HttpError(409, "Email already registered");
      }
      throw err;
    }
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const result = await pool.query(
      "SELECT id::int AS id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const row = result.rows[0];
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw new HttpError(401, "Invalid email or password");
    }
    res.json({ token: signToken(row.id), user: { id: row.id, email: row.email } });
  })
);
