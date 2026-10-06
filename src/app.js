import { LEVELS, analyzeText } from "./parser.js";
import { buildTimeline } from "./chart.js";
import { buildSample } from "./sample.js";
import { esc, formatTime } from "./util.js";

const $ = id => document.getElementById(id);
const ROW_LIMIT = 500;
const LARGE_FILE_BYTES = 50e6;
const state = { entries: [], formats: {}, levels: new Set(LEVELS), query: "", pattern: null, openRows: new Set() };

function load(text) {
  const { entries, formats } = analyzeText(text);
  Object.assign(state, { entries, formats, levels: new Set(LEVELS), query: "", pattern: null, openRows: new Set() });
  $("query").value = "";
  $("results").hidden = entries.length === 0;
  $("status").textContent = entries.length
    ? `Parsed ${entries.length.toLocaleString()} entries.`
    : "No log lines found. Paste or open a log file first.";
  render();
}

function renderStats() {
  const count = level => state.entries.filter(entry => entry.level === level).length;
  let first = Infinity;
  let last = -Infinity;
  let timedCount = 0;
  for (const entry of state.entries) {
    if (!entry.time) continue;
    timedCount++;
    const t = +entry.time;
    if (t < first) first = t;
    if (t > last) last = t;
  }
  const minutes = timedCount > 1 ? Math.max(1, Math.round((last - first) / 60000)) : 0;
  const span = !minutes ? "n/a" : minutes >= 120 ? `${(minutes / 60).toFixed(1)} h` : `${minutes} min`;
  const formatList = Object.entries(state.formats).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${n}`).join(", ");
  $("stats").innerHTML = [
    [state.entries.length.toLocaleString(), "entries"],
    [count("error").toLocaleString(), "errors"],
    [count("warn").toLocaleString(), "warnings"],
    [span, "time span"],
    [Object.keys(state.formats).length, `formats: ${formatList}`]
  ].map(([value, label]) => `<div class="stat"><b>${esc(value)}</b><span class="muted">${esc(label)}</span></div>`).join("");
}

function renderPatterns(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const group = groups.get(entry.pattern) || { count: 0, level: entry.level };
    group.count++;
    if (entry.level === "error") group.level = "error";
    groups.set(entry.pattern, group);
  }
  const top = [...groups].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  $("patterns").innerHTML = top.length
    ? top.map(([key, group]) => `<button class="pat" data-pattern="${esc(key)}" aria-pressed="${state.pattern === key}"><span class="dot ${group.level}"></span><span class="t" title="${esc(key)}">${esc(key)}</span><b>${group.count}</b></button>`).join("")
    : '<p class="muted">No entries match the current filters.</p>';
}

function renderRows(entries) {
  const clipped = entries.length > ROW_LIMIT ? `, showing first ${ROW_LIMIT}` : "";
  $("tableTitle").textContent = `Entries (${entries.length.toLocaleString()}${clipped})`;
  $("rows").innerHTML = entries.length
    ? entries.slice(0, ROW_LIMIT).map(entry => `<tr class="row" data-id="${entry.id}"><td class="time">${esc(formatTime(entry.time))}</td><td class="lvl ${entry.level}"><span><i class="dot"></i>${entry.level}</span></td><td class="msg">${esc(entry.message)}</td></tr><tr ${state.openRows.has(entry.id) ? "" : "hidden"}><td colspan="3"><pre>${esc(entry.raw)}</pre></td></tr>`).join("")
    : '<tr><td colspan="3" class="muted">No entries match the current filters.</td></tr>';
}

function render() {
  if (!state.entries.length) return;
  const query = state.query.toLowerCase();
  const filtered = state.entries.filter(entry => state.levels.has(entry.level) && (!query || entry.raw.toLowerCase().includes(query)));
  const shown = state.pattern ? filtered.filter(entry => entry.pattern === state.pattern) : filtered;

  renderStats();
  $("chips").innerHTML = LEVELS.map(level => `<button class="chip ${level}" data-level="${level}" aria-pressed="${state.levels.has(level)}"><span class="dot"></span>${level}</button>`).join("");
  $("timeline").innerHTML = buildTimeline(shown);
  renderPatterns(filtered);
  renderRows(shown);
}

$("analyze").onclick = () => load($("input").value);
$("sample").onclick = () => { $("input").value = buildSample(); load($("input").value); };
$("clear").onclick = () => {
  $("input").value = "";
  $("results").hidden = true;
  $("status").textContent = "";
  state.entries = [];
};
$("file").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  $("input").value = await file.text();
  load($("input").value);
  if (file.size > LARGE_FILE_BYTES) $("status").textContent += " This file is over 50 MB, so the page may feel slow.";
  event.target.value = "";
};
$("query").oninput = event => { state.query = event.target.value; render(); };
$("chips").onclick = event => {
  const chip = event.target.closest("[data-level]");
  if (!chip) return;
  const { level } = chip.dataset;
  state.levels.has(level) ? state.levels.delete(level) : state.levels.add(level);
  render();
};
$("patterns").onclick = event => {
  const button = event.target.closest("[data-pattern]");
  if (!button) return;
  state.pattern = state.pattern === button.dataset.pattern ? null : button.dataset.pattern;
  render();
};
$("rows").onclick = event => {
  const row = event.target.closest("tr.row");
  if (!row) return;
  const id = +row.dataset.id;
  state.openRows.has(id) ? state.openRows.delete(id) : state.openRows.add(id);
  row.nextElementSibling.hidden = !state.openRows.has(id);
};
