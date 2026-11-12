import { useState, type FormEvent } from "react";
import { api, errorText } from "../api/client";
import type { ImportResult } from "../api/types";

const MAX_BYTES = 1_000_000; // the backend limit is 1 MB

export function CsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // changing it clears the file input
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 1 MB.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      setResult(await api<ImportResult>("/import/csv", { method: "POST", text }));
      setFile(null);
      setInputKey((k) => k + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form">
      <p>
        Upload a CSV with a header row. Required columns: <code>title</code>, <code>difficulty</code>,{" "}
        <code>patterns</code>. Optional: <code>platform</code>, <code>external_id</code>, <code>url</code>,{" "}
        <code>approach</code>, <code>insight</code>, <code>first_review_in_days</code>.
      </p>
      <pre className="code">{`title,difficulty,patterns,platform,external_id
Valid Parentheses,easy,Stack,leetcode,20
Container With Most Water,medium,Two Pointers;Greedy,leetcode,11`}</pre>
      <p className="muted small">
        Separate several patterns with a semicolon. Without <code>first_review_in_days</code>, first reviews are
        spread over 7 days so you are not buried on day one. A bad row never blocks the good ones.
      </p>

      <form onSubmit={onSubmit} className="form">
        <label>
          CSV file
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button className="btn primary" type="submit" disabled={!file || busy}>
          {busy ? "Importing..." : "Import"}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div role="status">
          <p className="success">
            Imported {result.imported} of {result.total} rows. Skipped {result.skipped} already in your list.
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="error">{result.errors.length} rows had problems:</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e) => (
                    <tr key={e.row}>
                      <td>{e.row}</td>
                      <td>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
