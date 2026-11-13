export interface Series {
  name: string;
  color: string;
  values: number[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderSvg(title: string, subtitle: string, series: Series[]): string {
  const W = 760;
  const H = 430;
  const m = { l: 64, r: 24, t: 74, b: 84 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;

  const all = series.flatMap((s) => s.values);
  const yMin = Math.floor(Math.min(...all) * 10) / 10;
  let yMax = Math.min(1, Math.ceil(Math.max(...all) * 10) / 10);
  if (yMax - yMin < 0.1) yMax = yMin + 0.1;

  const n = series[0].values.length;
  const x = (i: number) => m.l + (n > 1 ? i / (n - 1) : 0) * pw;
  const y = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ph;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">`);
  out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  out.push(`<text x="${m.l}" y="30" font-size="18" font-weight="700" fill="#1c2330">${esc(title)}</text>`);
  out.push(`<text x="${m.l}" y="52" font-size="12" fill="#667085">${esc(subtitle)}</text>`);

  // horizontal grid + y labels
  for (let k = 0; k <= 5; k++) {
    const v = yMin + ((yMax - yMin) * k) / 5;
    out.push(`<line x1="${m.l}" y1="${y(v)}" x2="${W - m.r}" y2="${y(v)}" stroke="#e3e6eb"/>`);
    out.push(`<text x="${m.l - 8}" y="${y(v) + 4}" font-size="12" text-anchor="end" fill="#667085">${Math.round(v * 100)}%</text>`);
  }
  // x labels
  for (let d = 0; d < n; d += 10) {
    out.push(`<text x="${x(d)}" y="${H - m.b + 20}" font-size="12" text-anchor="middle" fill="#667085">${d}</text>`);
  }
  out.push(`<text x="${m.l + pw / 2}" y="${H - m.b + 40}" font-size="12" text-anchor="middle" fill="#667085">Day</text>`);
  out.push(`<text transform="translate(16 ${m.t + ph / 2}) rotate(-90)" font-size="12" text-anchor="middle" fill="#667085">Average recall probability</text>`);
  out.push(`<line x1="${m.l}" y1="${m.t + ph}" x2="${W - m.r}" y2="${m.t + ph}" stroke="#98a2b3"/>`);

  // lines
  for (const s of series) {
    const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    out.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`);
  }

  // legend
  series.forEach((s, i) => {
    const lx = m.l + i * 215;
    const ly = H - 22;
    out.push(`<line x1="${lx}" y1="${ly}" x2="${lx + 22}" y2="${ly}" stroke="${s.color}" stroke-width="3"/>`);
    out.push(`<text x="${lx + 28}" y="${ly + 4}" font-size="12" fill="#1c2330">${esc(s.name)}</text>`);
  });

  out.push("</svg>");
  return out.join("\n");
}
