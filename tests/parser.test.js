import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeText, detectLevel, parseLine, patternKey } from "../src/parser.js";

test("parses JSON lines with numeric and string levels", () => {
  const a = parseLine('{"level":50,"msg":"db down","time":"2024-05-01T10:00:00Z"}');
  assert.equal(a.format, "JSON");
  assert.equal(a.level, "error");
  assert.equal(a.time.toISOString(), "2024-05-01T10:00:00.000Z");
  assert.equal(parseLine('{"severity":"WARNING","message":"slow"}').level, "warn");
});

test("parses access logs and honours the timezone offset", () => {
  const utc = parseLine('1.2.3.4 - - [10/Oct/2023:13:55:36 +0000] "GET /a?x=1 HTTP/1.1" 500 12');
  assert.equal(utc.format, "Access");
  assert.equal(utc.level, "error");
  assert.equal(utc.message, "GET /a 500");
  assert.equal(utc.time.toISOString(), "2023-10-10T13:55:36.000Z");
  const plus2 = parseLine('1.2.3.4 - - [10/Oct/2023:13:55:36 +0200] "GET / HTTP/1.1" 404 12');
  assert.equal(plus2.time.toISOString(), "2023-10-10T11:55:36.000Z");
  assert.equal(plus2.level, "warn");
});

test("parses timestamped app logs", () => {
  const entry = parseLine("2024-05-01T10:00:00.123Z WARN  Slow query");
  assert.equal(entry.format, "Timestamped");
  assert.equal(entry.level, "warn");
  assert.equal(entry.message, "WARN  Slow query");
});

test("parses syslog lines", () => {
  const entry = parseLine("Oct  6 09:15:01 web1 sshd[42]: Failed password for root");
  assert.equal(entry.format, "Syslog");
  assert.equal(entry.level, "error");
  assert.equal(entry.time.getMonth(), 9);
});

test("falls back to plain text and keyword-based level detection", () => {
  assert.equal(parseLine("something odd happened").format, "Plain");
  assert.equal(detectLevel("connection refused"), "error");
  assert.equal(detectLevel("all fine"), "info");
});

test("attaches stack trace lines to the previous entry", () => {
  const { entries, formats } = analyzeText("2024-05-01T10:00:00Z ERROR boom\n    at a (a.js:1)\n    at b (b.js:2)\n2024-05-01T10:00:01Z INFO ok\n");
  assert.equal(entries.length, 2);
  assert.match(entries[0].raw, /at b \(b\.js:2\)/);
  assert.deepEqual(formats, { Timestamped: 2 });
});

test("groups messages that differ only in numbers, IPs and hashes", () => {
  assert.equal(patternKey("order 123 from 10.0.0.1"), patternKey("order 456 from 192.168.1.9"));
  assert.equal(patternKey("id deadbeef01"), "id <hex>");
});

test("empty input yields no entries", () => {
  assert.deepEqual(analyzeText("\n  \n").entries, []);
});
