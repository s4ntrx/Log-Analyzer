import { MONTHS } from "./parser.js";

const MONTH_NAMES = Object.keys(MONTHS);
const NORMAL = [
  ["INFO", "Request completed in {n}ms for user {n}"],
  ["INFO", "Cache hit for key session:{n}"],
  ["DEBUG", "Polling queue depth={n}"],
  ["INFO", "Health check ok"],
  ["WARN", "Slow query ({n}ms) on orders table"]
];
const FAULTS = [
  ["ERROR", "Connection refused to db-replica-2:5432"],
  ["ERROR", "Unhandled exception in payment worker, order {n}"],
  ["WARN", "Retrying upstream call, attempt {n}"]
];

export function buildSample() {
  let seed = 7;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const number = () => Math.floor(random() * 9000) + 100;
  const start = Date.now() - 2 * 3600e3;
  const lines = [];

  for (let i = 0; i < 420; i++) {
    const time = new Date(start + i * 17000 + random() * 5000);
    if (i % 9 === 0) {
      const n = number();
      const code = [200, 200, 200, 404, 500][Math.floor(random() * 5)];
      const day = String(time.getUTCDate()).padStart(2, "0");
      const stamp = `${day}/${MONTH_NAMES[time.getUTCMonth()]}/${time.getUTCFullYear()}:${time.toISOString().slice(11, 19)} +0000`;
      lines.push(`10.0.${n % 255}.${n % 200} - - [${stamp}] "GET /api/orders?id=${n} HTTP/1.1" ${code} 512`);
      continue;
    }
    const inOutage = i > 230 && i < 280;
    const pool = inOutage && random() < 0.6 ? FAULTS : NORMAL;
    const [level, template] = pool[Math.floor(random() * pool.length)];
    lines.push(`${time.toISOString()} ${level.padEnd(5)} ${template.replace(/\{n\}/g, () => number())}`);
    if (template.startsWith("Unhandled")) lines.push("    at PaymentWorker.charge (worker.js:88)", "    at Queue.process (queue.js:41)");
  }
  return lines.join("\n");
}
