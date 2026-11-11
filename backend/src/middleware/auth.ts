import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { HttpError } from "./errors";

export function signToken(userId: number): string {
  return jwt.sign({}, JWT_SECRET, { subject: String(userId), expiresIn: 60 * 60 * 24 * 7 });
}

export function requireAuth(req: Request, res: Response, _next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing token");
  }
  let userId = NaN;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    userId = Number(payload.sub);
  } catch {
    // fall through to the check below
  }
  if (!Number.isInteger(userId)) {
    throw new HttpError(401, "Invalid or expired token");
  }
  res.locals.userId = userId;
  _next();
}
