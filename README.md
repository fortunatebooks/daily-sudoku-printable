# Daily Sudoku

A tiny static website that shows one deterministic, printable Sudoku puzzle per UK calendar day.

## MVP

- Shows today's puzzle at `/`
- Shows date-specific puzzles at `/puzzle/YYYY-MM-DD`
- Provides print-friendly routes at `/print/YYYY-MM-DD` and `/print/today`
- Provides PDF download routes at `/pdf/YYYY-MM-DD` and `/pdf/today`
- Provides a simple history view at `/history`
- Uses Europe/London calendar dates for "today"
- Generates the same valid puzzle for the same date every time

## Local Development

```bash
npm test
npm run build
npm run dev
```

Then open `http://localhost:3000`.

## Deployment Notes

This is a static SPA. Deploy `dist/` with history fallback enabled so routes such as
`/puzzle/2026-06-11`, `/print/today`, `/pdf/today`, and `/history` serve `index.html`.

For here.now, publish with the `--spa` flag:

```bash
/Users/davidellis/.agents/skills/here-now/scripts/publish.sh dist --spa
```

The PDF routes in this MVP are browser-generated downloads. They are stable URLs for
interactive browsers, but they are not server-side `application/pdf` responses.

## Public Repo Safety

This project is designed to be public. Do not commit:

- `.env` files
- `.herenow/` deployment state
- generated `dist/`
- credentials or tokens
