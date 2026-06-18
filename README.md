# Jenny's Sudoku

Live site: <https://jennysudoku.com/>

A small personal project that makes a printable Sudoku sheet for each day.

It was built as a gift for my mum, who likes Sudoku and wanted something she
could print every morning: two fresh puzzles, a little local weather, and the
evening TV listings on one A4 page. The intended use is deliberately simple:
run the app on a small web host, then have `cron`, `launchd`, or another
scheduler download `/pdf/today` and send it to the printer.

This repo is public because the idea is easy to adapt. If you use it for your
own family or household, you will almost certainly want to change the title,
weather location, TV channels/listing source, domain, timezone, and maybe the
print layout.

## What It Does

- Shows today's puzzle sheet at `/`.
- Shows date-specific puzzles at `/puzzle/YYYY-MM-DD`.
- Provides print-friendly browser routes at `/print/today` and
  `/print/YYYY-MM-DD`.
- Provides PDF routes at `/pdf/today` and `/pdf/YYYY-MM-DD`.
- Provides a small history view at `/history`.
- Uses the UK `Europe/London` calendar day for "today".
- Prints two deterministic, valid Sudoku puzzles for each date.
- Uses a weekday schedule of Very Difficult plus Fiendish puzzles.
- Uses a weekend schedule of Fiendish plus Super Fiendish puzzles.
- Grades puzzles with a custom human-style grader based on solving techniques,
  not just clue count.
- Adds garden-friendly Christchurch, Dorset weather using Open-Meteo first,
  wttr.in second, and a stale cache as the last fallback.
- Adds evening TV listings from Freely for BBC One South, BBC Two, ITV1,
  Channel 4, and 5, laid out as readable channel bands.
- Builds an ink-saving black-and-white A4 PDF with the puzzles on the left,
  weather on the right, and a stable full-width TV guide section at the bottom.

The app has no runtime npm dependencies. It is plain JavaScript, a tiny Node
server, and a hand-built PDF writer.

## Useful Files

- `src/sudoku.js` handles date routing, deterministic puzzle generation,
  validation helpers, uniqueness checks, daily difficulty scheduling, and the
  custom human-style grader.
- `src/pdf.js` builds the ink-saving black-and-white A4 PDF. It draws the
  puzzle grids, givens, title, date, right-side weather, TV listings box, and
  includes text fitting/truncation so long programme titles do not spill out of
  the printable area.
- `src/weather.js` pulls weather from Open-Meteo, falls back to wttr.in, keeps
  fresh/stale cache windows, formats forecast lines, and calculates moon phase
  text for the printout.
- `src/tv-listings.js` pulls and normalizes Freely TV guide data, filters it to
  the evening window, formats display times, and prepares compact PDF lines.
- `src/app.js` is the browser app: route handling, rendering, download/print
  actions, and waiting for weather/TV data before PDF generation.
- `scripts/server.mjs` serves the app and the automation-friendly JSON/PDF
  endpoints.
- `scripts/build.mjs` copies `src/` to `dist/` and adds static-hosting files.
- `tests/*.mjs` cover Sudoku generation, PDF output, server routes, weather,
  and TV listings.

## Setup

Requirements:

- Node.js 20 or newer, for built-in `fetch` and `node --test`.
- Network access if you want live weather and TV listings.

```bash
npm install
npm test
npm run build
```

There are no package dependencies at the moment, but `npm install` is still a
useful habit because it creates the expected npm project state.

## Publish Safety

This project does not need secrets or private configuration. Keep `.env` files,
deployment tokens, generated PDFs, local `.herenow/` state, and `dist/` builds
out of git.

The npm package contents are allowlisted in `package.json` with the `files`
field. Before publishing or sharing a tarball, check the preview:

```bash
npm pack --dry-run
```

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

`npm run dev` and `npm start` both run `scripts/server.mjs`, so local PDF,
weather, TV, and JSON routes behave like the deployed automation server.

Useful local checks:

```bash
curl -L http://localhost:3000/pdf/today -o sudoku-today.pdf
curl -s http://localhost:3000/api/puzzle/today
curl -s http://localhost:3000/api/weather/today
curl -s http://localhost:3000/api/tv-listings/today
```

## Routes

Browser routes:

- `/`
- `/puzzle/YYYY-MM-DD`
- `/print/today`
- `/print/YYYY-MM-DD`
- `/pdf/today`
- `/pdf/YYYY-MM-DD`
- `/history`

Server API routes:

- `/api/puzzle/today`
- `/api/puzzle/YYYY-MM-DD`
- `/api/weather/today`
- `/api/weather/YYYY-MM-DD`
- `/api/tv-listings/today`
- `/api/tv-listings/YYYY-MM-DD`
- `/health`

When served by Node, `/pdf/today` returns a real `application/pdf` response.
That is the best route for scheduled downloads and automatic printing. In a
static-only deployment, the browser can still generate PDF downloads, but there
is no raw PDF response for automation.

`/api/puzzle/...` includes backward-compatible top-level puzzle fields for the
first puzzle, plus a `puzzles` array containing the full daily pair. Solutions
are not shown on the page or printout, but they are useful for validation,
testing, and future solution/answer features.

## Personalizing It

The current version is intentionally specific to Jenny:

- Title: `Jenny's Sudoku`
- Weather: Christchurch, Dorset
- TV region/source: Freely, with a fixed set of UK channels
- Timezone: `Europe/London`
- Deployed domain: `jennysudoku.com`

Good places to start changing things:

- Change the title in `src/index.html`, `src/app.js`, and `scripts/server.mjs`.
- Change weather coordinates and fallback URL in `src/weather.js`.
- Change the daily difficulty schedule or grading rules in `src/sudoku.js`.
- Change TV channels, Freely region id, listing window, or data source in
  `src/tv-listings.js`.
- Change PDF sizing, spacing, or title treatment in `src/pdf.js`.
- Change metadata and visible labels in `src/index.html`.
- Change deployment health/start settings in `railway.json` if you are not
  using Railway-style hosting.

Please check the terms for any weather or TV data source you choose. This app
was made for personal, small-scale use.

## Testing

```bash
npm test
```

The tests use Node's built-in test runner and cover the parts most likely to
break during personalization: puzzle determinism and validity, PDF layout,
server behavior, weather fallbacks, and TV listing normalization.

## Build

```bash
npm run build
```

This creates `dist/`, copies the static app files, writes `404.html` for SPA
fallback hosting, and adds a small `build.json`.

## Deploy

### Node Server

Use this when you want `/pdf/today` to be downloaded by a scheduled job. This
is how <https://jennysudoku.com/> is deployed:

```bash
npm run build
npm start
```

The server reads `PORT` if your host provides one:

```bash
PORT=8080 npm start
```

`railway.json` is included as an example Railway-style deployment:

- Build command: `npm run build`
- Start command: `npm start`
- Health check: `/health`

### Static Hosting

You can also deploy `dist/` as a static SPA with history fallback enabled.
Routes such as `/puzzle/2026-06-11`, `/print/today`, `/pdf/today`, and
`/history` should all serve `index.html`.

Static hosting is fine for manual use in a browser. For automatic printing,
prefer the Node server because it returns raw PDF bytes from `/pdf/today`.

## Daily Printing

Existing daily printing automation does not need to change. It downloads
`/pdf/today`, and that route now returns the current two-puzzle PDF sheet.

### Download Today's PDF

```bash
curl -fsSL "https://your-domain.example/pdf/today?download=1" \
  -o "$HOME/Desktop/sudoku-$(date +%F).pdf"
```

### Print On macOS Or Linux

```bash
#!/bin/zsh
set -euo pipefail

PDF="$HOME/Desktop/jennys-sudoku-$(date +%F).pdf"
curl -fsSL "https://your-domain.example/pdf/today?download=1" -o "$PDF"
lpr "$PDF"
```

### Cron Example

Run every morning at 7:00:

```cron
0 7 * * * /Users/you/bin/print-jennys-sudoku.sh >> /Users/you/Library/Logs/jennys-sudoku.log 2>&1
```

### launchd Example

Save a plist like this under `~/Library/LaunchAgents/` and point
`ProgramArguments` at your print script:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.example.jennys-sudoku-print</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/you/bin/print-jennys-sudoku.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/you/Library/Logs/jennys-sudoku.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/you/Library/Logs/jennys-sudoku.err.log</string>
</dict>
</plist>
```

Load it with:

```bash
launchctl load ~/Library/LaunchAgents/com.example.jennys-sudoku-print.plist
```

## Data Sources

- Weather: Open-Meteo public forecast API first, wttr.in public JSON forecast
  second, stale cache last.
- Moon phase: calculated locally from the puzzle date.
- TV listings: Freely website TV guide API, normalized to a compact
  19:00-23:00 `Europe/London` evening view.

## Public Repo Safety

This project is designed to be public. Do not commit:

- `.env` files
- `.herenow/` deployment state
- generated `dist/`
- credentials or tokens

## License

MIT. Use it, adapt it, and make it personal.
