import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// Express recognises error handlers by their 4 parameters.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
    });
  }
  const e = err as { status?: number };
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
    return res.status(e.status).json({ error: "Bad request" }); // e.g. malformed JSON
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
