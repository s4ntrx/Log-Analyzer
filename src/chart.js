import { esc, formatTime } from "./util.js";

const BUCKETS = 48;
const BAR_STEP = 20;
const BASELINE = 118;
const MAX_BAR_HEIGHT = 108;

export function buildTimeline(entries) {
  const timed = entries.filter(entry => entry.time);
  if (timed.length < 2) return '<p class="muted">Not enough timestamped entries to chart.</p>';

  let first = Infinity;
  let last = -Infinity;
  for (const entry of timed) {
    const t = +entry.time;
    if (t < first) first = t;
    if (t > last) last = t;
  }
  const span = last - first || 1;
  const buckets = Array.from({ length: BUCKETS }, () => ({ error: 0, warn: 0, other: 0 }));
  for (const entry of timed) {
    const index = Math.min(BUCKETS - 1, Math.floor((+entry.time - first) / span * BUCKETS));
    buckets[index][entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "other"]++;
  }
  const peak = Math.max(...buckets.map(b => b.error + b.warn + b.other));

  const bars = buckets.map((bucket, index) => {
    const title = `${formatTime(new Date(first + span * index / BUCKETS))}: ${bucket.error} errors, ${bucket.warn} warnings, ${bucket.other} other`;
    let y = BASELINE;
    return ["error", "warn", "other"].map(key => {
      const height = bucket[key] / peak * MAX_BAR_HEIGHT;
      if (!height) return "";
      y -= height;
      return `<rect class="bar-${key}" x="${index * BAR_STEP + 1}" y="${y}" width="${BAR_STEP - 3}" height="${height}" rx="2"><title>${title}</title></rect>`;
    }).join("");
  }).join("");

  return `<svg viewBox="0 0 960 138" width="100%" style="min-width:520px" role="img" aria-label="Log volume over time">${bars}<text class="axis" x="0" y="134">${esc(formatTime(new Date(first)))}</text><text class="axis" x="960" y="134" text-anchor="end">${esc(formatTime(new Date(last)))}</text></svg>`;
}
