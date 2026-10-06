export const LEVELS = ["error", "warn", "info", "debug"];
export const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const LEVEL_ALIASES = { fatal: "error", critical: "error", crit: "error", severe: "error", err: "error", error: "error", warn: "warn", warning: "warn", info: "info", notice: "info", debug: "debug", trace: "debug" };
const LEVEL_RE = /\b(FATAL|CRITICAL|CRIT|SEVERE|ERROR|ERR|WARNING|WARN|INFO|NOTICE|DEBUG|TRACE)\b/i;
const ACCESS_RE = /^(\S+) \S+ \S+ \[(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+) ([+-])(\d{2})(\d{2})\] "(\S+) (\S+)[^"]*" (\d{3}) /;
const ISO_RE = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*(.*)$/;
const SYSLOG_RE = /^([A-Z][a-z]{2})\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2})\s+(\S+)\s+(.*)$/;
const CONTINUATION_RE = /^(\s+\S|Caused by:|Traceback)/;

export function detectLevel(text) {
  const found = text.match(LEVEL_RE);
  if (found) return LEVEL_ALIASES[found[1].toLowerCase()];
  return /fail|denied|refused|exception|panic|timed? ?out/i.test(text) ? "error" : "info";
}

export function toDate(value) {
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return isNaN(date) ? null : date;
}

const statusLevel = code => (code >= 500 ? "error" : code >= 400 ? "warn" : "info");

export function patternKey(message) {
  return message
    .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
    .replace(/\d+(\.\d+){3}/g, "<ip>")
    .replace(/\d+/g, "<n>")
    .slice(0, 120);
}

export function parseLine(line) {
  const text = line.trim();
  if (text[0] === "{") {
    try {
      const obj = JSON.parse(text);
      const message = String(obj.message || obj.msg || obj.event || text);
      const rawLevel = obj.level ?? obj.severity ?? obj.lvl;
      const level = typeof rawLevel === "number"
        ? (rawLevel >= 50 ? "error" : rawLevel >= 40 ? "warn" : rawLevel >= 30 ? "info" : "debug")
        : LEVEL_ALIASES[String(rawLevel || "").toLowerCase()] || detectLevel(message);
      const stamp = obj.timestamp ?? obj.time ?? obj["@timestamp"] ?? obj.ts;
      return { format: "JSON", time: stamp != null ? toDate(stamp) : null, level, message, raw: text };
    } catch { /* not valid JSON, try other formats */ }
  }

  let m = text.match(ACCESS_RE);
  if (m && m[3] in MONTHS) {
    const offsetMs = (m[8] === "-" ? -1 : 1) * (+m[9] * 60 + +m[10]) * 60000;
    const time = new Date(Date.UTC(+m[4], MONTHS[m[3]], +m[2], +m[5], +m[6], +m[7]) - offsetMs);
    return { format: "Access", time, level: statusLevel(+m[13]), message: `${m[11]} ${m[12].split("?")[0]} ${m[13]}`, raw: text };
  }

  m = text.match(ISO_RE);
  if (m) {
    const time = toDate(m[1].replace(",", ".").replace(" ", "T"));
    return { format: "Timestamped", time, level: detectLevel(m[2]), message: m[2], raw: text };
  }

  m = text.match(SYSLOG_RE);
  if (m && m[1] in MONTHS) {
    const time = new Date(new Date().getFullYear(), MONTHS[m[1]], +m[2], +m[3], +m[4], +m[5]);
    return { format: "Syslog", time, level: detectLevel(m[7]), message: m[7], raw: text };
  }

  return { format: "Plain", time: null, level: detectLevel(text), message: text, raw: text };
}

export function analyzeText(text) {
  const entries = [];
  const formats = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const previous = entries[entries.length - 1];
    if (previous && CONTINUATION_RE.test(line)) {
      previous.raw += "\n" + line;
      continue;
    }
    const entry = parseLine(line);
    entry.id = entries.length;
    entry.pattern = patternKey(entry.message);
    formats[entry.format] = (formats[entry.format] || 0) + 1;
    entries.push(entry);
  }
  return { entries, formats };
}
