import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errorText } from "../api/client";
import type { Overview, PatternStat } from "../api/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patterns: PatternStat[]; overview: Overview };

const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
};

function masteryColor(mastery: number): string {
  if (mastery < 0.4) return "var(--hard)";
  if (mastery < 0.65) return "var(--medium)";
  return "var(--easy)";
}

function dayLabel(day: number): string {
  return day === 0 ? "<24h" : `${day}d`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

function RankList({ title, items }: { title: string; items: PatternStat[] }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted small">Not enough reviews yet.</p>
      ) : (
        <ol className="rank">
          {items.map((p) => (
            <li key={p.patternId}>
              <span>{p.name}</span>
              <strong>{Math.round(p.mastery * 100)}%</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Insights() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<PatternStat[]>("/stats/patterns"), api<Overview>("/stats/overview")])
      .then(([patterns, overview]) => {
        if (!cancelled) setState({ status: "ready", patterns, overview });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (state.status === "loading") return <p className="muted">Loading insights...</p>;

  if (state.status === "error") {
    return (
      <div className="card">
        <p className="error">{state.message}</p>
        <button
          className="btn"
          onClick={() => {
            setState({ status: "loading" });
            setReloadKey((k) => k + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const { patterns, overview } = state;

  if (overview.totalCards === 0) {
    return (
      <div className="card empty">
        <h2>No insights yet</h2>
        <p className="muted">Add the problems you have solved, and insights appear once you start reviewing.</p>
        <Link className="btn primary" to="/add">
          Add a problem
        </Link>
      </div>
    );
  }

  // patterns arrive sorted weakest first. Only patterns with real reviews can be ranked.
  const reviewed = patterns.filter((p) => p.recentReviews > 0);
  const weakest = reviewed.slice(0, 3);
  const strongest = reviewed
    .slice(-3)
    .reverse()
    .filter((p) => !weakest.some((w) => w.patternId === p.patternId));

  const masteryData = patterns.map((p) => ({
    name: p.name,
    score: Math.round(p.mastery * 100),
    hasData: p.recentReviews > 0,
    mastery: p.mastery,
  }));
  const upcomingData = overview.days.map((d) => ({ label: dayLabel(d.day), count: d.count }));
  const dueSoon = overview.days.reduce((s, d) => s + d.count, 0);

  return (
    <>
      <h1>Insights</h1>

      <div className="tiles">
        <Tile label="Problems tracked" value={String(overview.totalCards)} />
        <Tile label="Due now" value={String(overview.dueNow)} />
        <Tile label="Reviews, last 7 days" value={String(overview.reviews7d)} />
        <Tile
          label="Recall rate, 30 days"
          value={overview.recallRate30d === null ? "-" : `${Math.round(overview.recallRate30d * 100)}%`}
          hint={overview.reviews30d > 0 ? `${overview.reviews30d} reviews` : "No reviews yet"}
        />
      </div>

      <div className="insight-grid">
        <RankList title="Weakest patterns" items={weakest} />
        <RankList title="Strongest patterns" items={strongest} />
      </div>

      <section className="card chart-card">
        <h2>Mastery by pattern</h2>
        <p className="muted small">
          Score from your recent ratings, newer reviews counting more. Grey bars have no reviews yet, so they only show
          the neutral starting value.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(180, masteryData.length * 34 + 40)}>
          <BarChart data={masteryData} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} stroke="var(--border)" />
            <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} stroke="var(--border)" />
            <Tooltip cursor={{ fill: "transparent" }} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="score" name="Mastery (%)" radius={[0, 4, 4, 0]}>
              {masteryData.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.hasData ? masteryColor(d.mastery) : "var(--muted)"}
                  fillOpacity={d.hasData ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card chart-card">
        <h2>Upcoming reviews</h2>
        <p className="muted small">
          Cards due in each 24-hour window from now ({dueSoon} in the next 14 days
          {overview.later > 0 ? `, ${overview.later} later` : ""}).
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={upcomingData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} stroke="var(--border)" />
            <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="var(--border)" />
            <Tooltip cursor={{ fill: "transparent" }} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Cards due" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
