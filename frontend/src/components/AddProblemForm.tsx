import { useEffect, useState, type FormEvent } from "react";
import { api, errorText } from "../api/client";
import type { AddedProblem, Pattern } from "../api/types";

const MAX_PATTERNS = 5;

function firstReviewLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

export function AddProblemForm() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [platform, setPlatform] = useState("leetcode");
  const [externalId, setExternalId] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [solveMinutes, setSolveMinutes] = useState("");
  const [neededHint, setNeededHint] = useState(false);
  const [approach, setApproach] = useState("");
  const [insight, setInsight] = useState("");
  const [firstReviewInDays, setFirstReviewInDays] = useState("1");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Pattern[]>("/patterns")
      .then((data) => {
        if (!cancelled) setPatterns(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPatternsError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(name: string) {
    setSelected((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (selected.length === 0) {
      setError("Pick at least one pattern.");
      return;
    }

    const days = Number(firstReviewInDays);
    const body: Record<string, unknown> = {
      platform: platform.trim() || "leetcode",
      title: title.trim(),
      difficulty,
      patterns: selected,
      neededHint,
      firstReviewInDays: days,
    };
    if (externalId.trim()) body.externalId = externalId.trim();
    if (url.trim()) body.url = url.trim();
    if (solveMinutes.trim()) body.solveMinutes = Number(solveMinutes);
    if (approach.trim()) body.approachText = approach.trim();
    if (insight.trim()) body.keyInsight = insight.trim();

    setBusy(true);
    try {
      const added = await api<AddedProblem>("/problems", { method: "POST", body });
      setSuccess(`Added "${added.title}". First review ${firstReviewLabel(days)}.`);
      // Keep platform, difficulty and first-review delay so logging several problems is quick.
      setTitle("");
      setExternalId("");
      setUrl("");
      setSelected([]);
      setSolveMinutes("");
      setNeededHint(false);
      setApproach("");
      setInsight("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <label>
        Problem title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </label>

      <div className="grid2">
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          Platform
          <input value={platform} onChange={(e) => setPlatform(e.target.value)} required />
        </label>
      </div>

      <div className="grid2">
        <label>
          Problem number or id (optional)
          <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="e.g. 3" />
        </label>
        <label>
          Link (optional)
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </label>
      </div>

      <fieldset>
        <legend>
          Patterns <span className="muted small">(pick 1 to {MAX_PATTERNS})</span>
        </legend>
        {patternsError && <p className="error">{patternsError}</p>}
        {!patternsError && patterns.length === 0 && <p className="muted small">Loading patterns...</p>}
        <div className="chips">
          {patterns.map((p) => {
            const on = selected.includes(p.name);
            return (
              <button
                key={p.id}
                type="button"
                className={`chip toggle${on ? " on" : ""}`}
                aria-pressed={on}
                title={p.description ?? undefined}
                disabled={!on && selected.length >= MAX_PATTERNS}
                onClick={() => toggle(p.name)}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label>
        Your approach (shown to you during revision)
        <textarea rows={4} value={approach} onChange={(e) => setApproach(e.target.value)} maxLength={5000} />
      </label>
      <label>
        Key insight (optional)
        <textarea rows={2} value={insight} onChange={(e) => setInsight(e.target.value)} maxLength={2000} />
      </label>

      <div className="grid2">
        <label>
          Minutes it took (optional)
          <input type="number" min={0} max={600} value={solveMinutes} onChange={(e) => setSolveMinutes(e.target.value)} />
        </label>
        <label>
          First review in (days)
          <input
            type="number"
            min={0}
            max={30}
            step={1}
            value={firstReviewInDays}
            onChange={(e) => setFirstReviewInDays(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="check">
        <input type="checkbox" checked={neededHint} onChange={(e) => setNeededHint(e.target.checked)} />
        I needed a hint or the solution
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}

      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Adding..." : "Add problem"}
      </button>
    </form>
  );
}
