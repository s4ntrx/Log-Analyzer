# Log Analyzer

A browser-based log analyzer. Paste or open a log file and get format detection, a volume timeline, grouped repeated messages, and a searchable, filterable table. No backend, no dependencies, no build step. Everything is parsed locally, so nothing is uploaded.

## Quick start

```bash
git clone https://github.com/<your-user>/log-analyzer.git
cd log-analyzer
npm start        # serves http://localhost:8080
npm test         # runs the parser tests (Node 18+)
```

The app uses ES modules, so it must be served over HTTP. Opening `index.html` directly from disk will not work in most browsers.

## Supported formats

Each line is detected independently, so mixed files work.

| Format | Example |
| --- | --- |
| JSON lines | `{"level":"error","msg":"db down","time":"2024-05-01T10:00:00Z"}` |
| Access log (nginx/Apache combined) | `1.2.3.4 - - [10/Oct/2023:13:55:36 +0000] "GET / HTTP/1.1" 500 12` |
| Timestamped app log | `2024-05-01T10:00:00Z ERROR Connection refused` |
| Syslog | `Oct  6 09:15:01 web1 sshd[42]: Failed password` |
| Plain text | Level guessed from keywords such as `failed`, `denied`, `timeout` |

Indented lines and lines starting with `Caused by:` or `Traceback` are attached to the previous entry as stack trace.

Levels are normalized to `error`, `warn`, `info` and `debug`. Access-log status codes map to levels: 5xx is error, 4xx is warn.

## Features

- Level filters and text search
- Volume timeline split into errors, warnings and other
- Repeated-message grouping: numbers, IPs and hex IDs are masked, so `order 123` and `order 456` count as one pattern. Click a pattern to filter by it
- Click a row to see the raw line and stack trace

## Project structure

```
index.html            page markup
src/parser.js         format detection and parsing (pure, unit-tested)
src/chart.js          timeline SVG builder
src/app.js            state, rendering, event handlers
src/sample.js         deterministic sample log generator
src/util.js           HTML escaping, time formatting
src/styles.css        light and dark themes
tests/parser.test.js  node:test suite
.github/workflows/    CI and GitHub Pages deploy
```

## Deploy

Push to `main` and enable **Settings > Pages > Source: GitHub Actions**. The `pages.yml` workflow publishes the site.

## Limits

- Parsing runs in memory on the main thread. Files over roughly 50 MB will make the tab sluggish. For larger files use `grep`/`awk` first, or move the parser into a Web Worker.
- The table renders the first 500 matching rows only.
- Syslog lines carry no year, so the current year is assumed.
- Timestamps without a timezone are read as local time.

## Contributing

Add a format by writing a regex and a branch in `parseLine` in `src/parser.js`, plus a test in `tests/parser.test.js`. Run `npm test` before opening a pull request.

## License

MIT
