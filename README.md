# Jenny's Sudoku

A tiny static website that shows one deterministic, printable Sudoku puzzle per UK calendar day.

## MVP

- Shows today's puzzle at `/`
- Shows date-specific puzzles at `/puzzle/YYYY-MM-DD`
- Provides print-friendly routes at `/print/YYYY-MM-DD` and `/print/today`
- Provides PDF download routes at `/pdf/YYYY-MM-DD` and `/pdf/today`
- Provides a simple history view at `/history`
- Optional Node server returns real `application/pdf` responses for `/pdf/YYYY-MM-DD`
- Uses Europe/London calendar dates for "today"
- Generates the same valid puzzle for the same date every time
- Adds Christchurch weather with Open-Meteo primary data, wttr.in fallback, and cache fallback
- Adds server-backed mini TV listings from Freely for BBC One South, BBC Two, ITV1, Channel 4, and 5

## Local Development

```bash
npm test
npm run build
npm run dev
```

Then open `http://localhost:3000`.

`npm run dev` and `npm start` both run the Node server, so local weather, TV, JSON, and
raw PDF routes all behave like the automation deployment.

For automation-ready PDF routes:

```bash
npm start
curl -L http://localhost:3000/pdf/today -o sudoku-today.pdf
```

## Deployment Notes

### Static preview

The static build is an SPA. Deploy `dist/` with history fallback enabled so routes such as
`/puzzle/2026-06-11`, `/print/today`, `/pdf/today`, and `/history` serve `index.html`.

For here.now, publish with the `--spa` flag:

```bash
/Users/davidellis/.agents/skills/here-now/scripts/publish.sh dist --spa
```

In static mode, PDF routes are browser-generated downloads.

### Automation / Railway-style deployment

Run `npm start` to serve the same app with raw PDF endpoints:

- `/pdf/today`
- `/pdf/YYYY-MM-DD`
- `/api/puzzle/today`
- `/api/puzzle/YYYY-MM-DD`
- `/api/weather/today`
- `/api/weather/YYYY-MM-DD`
- `/api/tv-listings/today`
- `/api/tv-listings/YYYY-MM-DD`
- `/health`

These routes are better for scheduled download/print scripts because `/pdf/today`
responds directly with `application/pdf`.

Example daily download:

```bash
curl -L https://your-domain.example/pdf/today?download=1 -o "$HOME/Desktop/sudoku-today.pdf"
```

Example macOS print script:

```bash
#!/bin/zsh
set -euo pipefail

PDF="$HOME/Desktop/jennys-sudoku-$(date +%F).pdf"
curl -fsSL "https://your-domain.example/pdf/today?download=1" -o "$PDF"
lpr "$PDF"
```

## Data Sources

- Weather: Open-Meteo public forecast API first; wttr.in public JSON forecast as a no-key fallback; stale cache as last resort.
- Moon phase: calculated locally from the puzzle date.
- TV listings: Freely website TV guide API for personal-use server rendering. The app
  keeps only fixed channel names, start times, and titles for the 19:00-23:00
  Europe/London window, with cache and unavailable fallback behavior.

## Candidate Next Improvements

- Optional screen-only solution view and optional second-page solution print.
- GOV.UK bank holiday line with long cache.
- Derived "best dry spell" from the existing weather data.
- Custom favicon and social preview image.
- Uptime monitoring for the Node deployment.

## Public Repo Safety

This project is designed to be public. Do not commit:

- `.env` files
- `.herenow/` deployment state
- generated `dist/`
- credentials or tokens
