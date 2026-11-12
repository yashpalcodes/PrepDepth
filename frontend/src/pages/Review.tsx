import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorText } from "../api/client";
import type { CardDetail, QueueCard, QueueResponse, Rating, ReviewResponse } from "../api/types";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cards: QueueCard[]; waiting: number };

type Phase = "recall" | "reveal" | "rated";

const RATINGS: { value: Rating; label: string; hint: string; cls: string }[] = [
  { value: 1, label: "Forgot", hint: "Could not recall it", cls: "forgot" },
  { value: 2, label: "Hard", hint: "Got there with effort", cls: "hard" },
  { value: 3, label: "Good", hint: "Recalled it", cls: "good" },
  { value: 4, label: "Easy", hint: "Instantly", cls: "easy" },
];

const EMPTY_COUNTS: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

function nextLabel(intervalDays: number): string {
  const d = Math.round(intervalDays);
  return d <= 1 ? "tomorrow" : `in ${d} days`;
}

export default function Review() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("recall");
  const [recall, setRecall] = useState("");
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [counts, setCounts] = useState<Record<Rating, number>>(EMPTY_COUNTS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0); // when the current card was shown

  useEffect(() => {
    let cancelled = false;
    api<QueueResponse>("/queue/today")
      .then((data) => {
        if (cancelled) return;
        setLoad({ status: "ready", cards: data.cards, waiting: data.totalDue - data.cards.length });
        startedAt.current = Date.now();
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: "error", message: errorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /** Reset everything and fetch a fresh queue. */
  function restart() {
    setLoad({ status: "loading" });
    setIndex(0);
    setPhase("recall");
    setRecall("");
    setDetail(null);
    setResult(null);
    setCounts(EMPTY_COUNTS);
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function showNotes(card: QueueCard) {
    setError(null);
    setBusy(true);
    try {
      setDetail(await api<CardDetail>(`/cards/${card.id}`));
      setPhase("reveal");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function rate(card: QueueCard, rating: Rating) {
    setError(null);
    setBusy(true);
    const recallMinutes = Math.min(600, Math.round((Date.now() - startedAt.current) / 60000));
    try {
      const res = await api<ReviewResponse>("/reviews", {
        method: "POST",
        body: { userProblemId: card.id, rating, recallMinutes },
      });
      setResult(res);
      setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
      setPhase("rated");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setIndex((i) => i + 1);
    setPhase("recall");
    setRecall("");
    setDetail(null);
    setResult(null);
    setError(null);
    startedAt.current = Date.now();
  }

  if (load.status === "loading") return <p className="muted">Loading your revision...</p>;

  if (load.status === "error") {
    return (
      <div className="card">
        <p className="error">{load.message}</p>
        <button className="btn" onClick={restart}>
          Try again
        </button>
      </div>
    );
  }

  const { cards, waiting } = load;

  if (cards.length === 0) {
    return (
      <div className="card empty">
        <h2>Nothing to revise</h2>
        <p className="muted">You are all caught up.</p>
        <Link className="btn primary" to="/">
          Back to Today
        </Link>
      </div>
    );
  }

  if (index >= cards.length) {
    return (
      <div className="card">
        <h1>Session complete</h1>
        <p className="lead">
          You reviewed <strong>{cards.length}</strong> {cards.length === 1 ? "problem" : "problems"}.
        </p>
        <ul className="summary">
          {RATINGS.map((r) => (
            <li key={r.value}>
              <span className={`badge-dot ${r.cls}`} /> {r.label}: <strong>{counts[r.value]}</strong>
            </li>
          ))}
        </ul>
        {waiting > 0 && (
          <p className="muted">
            {waiting} more {waiting === 1 ? "problem is" : "problems are"} due. Do another round if you have time.
          </p>
        )}
        <div className="actions">
          {waiting > 0 && (
            <button className="btn primary" onClick={restart}>
              Check for more
            </button>
          )}
          <Link className="btn" to="/">
            Back to Today
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const isLast = index === cards.length - 1;

  return (
    <>
      <div className="progress-row">
        <span className="muted small">
          Problem {index + 1} of {cards.length}
        </span>
        <div className="progress" aria-hidden="true">
          <div className="bar" style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
      </div>

      <div className="card review-card">
        <div className="between">
          <h1>{card.title}</h1>
          <span className={`badge ${card.difficulty}`}>{card.difficulty}</span>
        </div>
        <div className="chips">
          {card.patterns.map((p) => (
            <span key={p} className="chip">
              {p}
            </span>
          ))}
        </div>
        {card.url && (
          <p className="small">
            <a href={card.url} target="_blank" rel="noopener noreferrer">
              Open the problem
            </a>
          </p>
        )}

        {phase === "recall" && (
          <>
            <label>
              How would you solve it? Write your approach from memory.
              <textarea
                rows={5}
                value={recall}
                onChange={(e) => setRecall(e.target.value)}
                placeholder="e.g. Use a sliding window and a map of last seen positions..."
              />
            </label>
            <p className="muted small">Writing it out works better than just thinking about it. This text stays in your browser.</p>
            <button className="btn primary big" disabled={busy} onClick={() => showNotes(card)}>
              {busy ? "Loading..." : "Show my notes"}
            </button>
          </>
        )}

        {phase !== "recall" && detail && (
          <div className="compare">
            <div className="panel">
              <h2>What you wrote now</h2>
              <p className="pre">{recall.trim() || "You skipped writing."}</p>
            </div>
            <div className="panel">
              <h2>Your saved notes</h2>
              {detail.notes ? (
                <>
                  {detail.notes.approachText && <p className="pre">{detail.notes.approachText}</p>}
                  {detail.notes.keyInsight && (
                    <p className="pre">
                      <strong>Key insight:</strong> {detail.notes.keyInsight}
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">No notes were saved for this problem.</p>
              )}
            </div>
          </div>
        )}

        {phase === "reveal" && (
          <>
            <p className="lead-sm">How well did you remember it? Be honest. The schedule depends on it.</p>
            <div className="ratings">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  className={`btn rate ${r.cls}`}
                  disabled={busy}
                  onClick={() => rate(card, r.value)}
                >
                  <strong>{r.label}</strong>
                  <span className="small muted">{r.hint}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "rated" && result && (
          <div className="rated">
            <p role="status">
              Saved. You will see this problem again <strong>{nextLabel(result.intervalDays)}</strong>.
            </p>
            <button className="btn primary big" onClick={next}>
              {isLast ? "Finish" : "Next problem"}
            </button>
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
