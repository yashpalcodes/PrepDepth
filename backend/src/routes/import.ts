import express, { Router } from "express";
import { parse } from "csv-parse/sync";
import { withTransaction } from "../db/tx";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errors";
import { addProblem, addProblemSchema } from "../services/problemService";

const MAX_ROWS = 500;
const REQUIRED_COLUMNS = ["title", "difficulty", "patterns"];

export const importRouter = Router();

importRouter.post(
  "/csv",
  express.text({ type: "*/*", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const userId: number = res.locals.userId;

    if (typeof req.body !== "string" || req.body.trim() === "") {
      throw new HttpError(400, "Send the CSV as the request body with Content-Type: text/csv");
    }

    let records: Record<string, string>[];
    try {
      records = parse(req.body, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (err) {
      throw new HttpError(400, `Could not parse CSV: ${(err as Error).message}`);
    }

    if (records.length === 0) throw new HttpError(400, "CSV has no data rows");
    if (records.length > MAX_ROWS) throw new HttpError(400, `Too many rows (max ${MAX_ROWS})`);
    const missing = REQUIRED_COLUMNS.filter((c) => !(c in records[0]));
    if (missing.length > 0) {
      throw new HttpError(400, `Missing column(s): ${missing.join(", ")}`);
    }

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const row = i + 2; // row 1 is the header

      const parsed = addProblemSchema.safeParse({
        platform: r.platform || undefined,
        externalId: r.external_id || undefined,
        title: r.title,
        url: r.url || undefined,
        difficulty: r.difficulty?.toLowerCase(),
        patterns: (r.patterns ?? "").split(/[;|]/).map((s) => s.trim()).filter(Boolean),
        approachText: r.approach || undefined,
        keyInsight: r.insight || undefined,
        // Spread first reviews across a week so the queue stays manageable.
        firstReviewInDays: r.first_review_in_days ? Number(r.first_review_in_days) : i % 7,
      });
      if (!parsed.success) {
        const message = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
          .join("; ");
        errors.push({ row, message });
        continue;
      }

      try {
        // One transaction per row: a bad row never blocks the good ones.
        await withTransaction((client) => addProblem(client, userId, parsed.data));
        imported++;
      } catch (err) {
        if (err instanceof HttpError && err.status === 409) {
          skipped++; // already in this user's list
        } else if (err instanceof HttpError) {
          errors.push({ row, message: err.message });
        } else {
          throw err;
        }
      }
    }

    res.json({ total: records.length, imported, skipped, errors });
  })
);
