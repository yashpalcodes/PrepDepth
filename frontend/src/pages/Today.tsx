import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { QueueResponse } from "../api/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: QueueResponse; loadedAt: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function dueLabel(dueAt: string, now: number): string {
  const days = Math.floor((now - Date.parse(dueAt)) / DAY_MS);
  if (days <= 0) return "Due today";
  return days === 1 ? "1 day late" : `${days} days late`;
}

export default function Today() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<QueueResponse>("/queue/today")
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, loadedAt: Date.now() });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Something went wrong",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }

  if (state.status === "loading") return <p className="muted">Loading today's revision...</p>;

  if (state.status === "error") {
    return (
      <div className="card">
        <p className="error">{state.message}</p>
        <button className="btn" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const { data, loadedAt } = state;
  const waiting = data.totalDue - data.cards.length;

  return (
    <>
      <h1>{greeting()}!</h1>

      {data.cards.length === 0 ? (
        <div className="card empty">
          <h2>Nothing due today</h2>
          <p className="muted">You are all caught up. Solve a new problem and add it to start its schedule.</p><Link className="btn primary" to="/add">Add a problem</Link>
        </div>
      ) : (
        <>
          <p className="lead">
            You have <strong>{data.cards.length}</strong>{" "}
            {data.cards.length === 1 ? "problem" : "problems"} to revise today.
          </p>
          {waiting > 0 && (
            <p className="muted small">
              Daily limit is {data.limit}. {waiting} more {waiting === 1 ? "is" : "are"} waiting for later days.
            </p>
          )}

          <ul className="card-list">
            {data.cards.map((c) => (
              <li key={c.id} className="card row">
                <div className="grow">
                  <div className="title">{c.title}</div>
                  <div className="chips">
                    {c.patterns.map((p) => (
                      <span key={p} className="chip">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="meta">
                  <span className={`badge ${c.difficulty}`}>{c.difficulty}</span>
                  <span className="muted small">{dueLabel(c.dueAt, loadedAt)}</span>
                </div>
              </li>
            ))}
          </ul>

          <button className="btn primary big" onClick={() => navigate("/review")}>
            Start revision
          </button>
        </>
      )}
    </>
  );
}
