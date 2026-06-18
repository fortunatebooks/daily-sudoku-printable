# Jenny's Sudoku PDF / Printout Rendering Brief

This document is for an analyst reviewing the A4 PDF printout layout, typography, data density, and rendering logic. It intentionally excludes Sudoku generation internals. The page currently renders two Sudoku puzzles, a right-side garden-friendly weather panel, and a fixed-footprint evening TV guide.

Relevant files:

- `src/pdf.js`: hand-built PDF rendering, layout constants, drawing helpers, text boxes, clipping, and TV fitting.
- `src/font-metrics.js`: standard PDF font width measurement, truncation, and wrapping helpers.
- `src/weather.js`: Open-Meteo/wttr.in fetching, normalization, garden summaries, and fallback weather lines.
- `src/tv-listings.js`: Freely TV guide fetching, event parsing, overlap filtering, and normalized TV data.
- `tests/pdf.test.mjs`, `tests/weather.test.mjs`, `tests/tv-listings.test.mjs`: PDF byte-level and normalization tests.

## Goal

The daily PDF is automatically downloaded and printed on A4 in grayscale/draft quality. It should feel like a calm black-and-white newspaper puzzle sheet: the puzzles are the core feature, weather is practical at a glance, and TV listings are readable without tiny text.

Current design goals:

- Keep two Sudoku grids at about 204 pt each.
- Keep the bottom TV area stable to avoid printer clipping.
- Use a Today-plus-next-three-days weather panel instead of four equal cards.
- Use full-width channel-band TV rows instead of five narrow columns.
- Keep meaningful text at or above 8.5 pt.
- Prefer truncation or `+n later` over shrinking text too far.
- Clip major sections as a safety guard for unattended printing.

## Page Model

The PDF is not generated from HTML. It is a PDF 1.4 document assembled by writing drawing commands directly.

Coordinate system:

- Origin is bottom-left.
- `x` increases right.
- `y` increases upward.
- Units are PDF points.

Current high-level constants:

```js
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN_X = 32;
const PAGE_MARGIN_TOP = 30;
const PAGE_MARGIN_BOTTOM = 30;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN_X * 2;

const TITLE_Y = 795;
const DATE_Y = 768;
const TITLE_RULE_Y = 749;

const PUZZLE_GRID_SIZE = 204;
const PUZZLE_GRID_X = 36;
const PUZZLE_ONE_GRID_Y = 524;
const PUZZLE_TWO_GRID_Y = 296;
const PUZZLE_ONE_LABEL_Y = PUZZLE_ONE_GRID_Y + PUZZLE_GRID_SIZE + 8;
const PUZZLE_TWO_LABEL_Y = PUZZLE_TWO_GRID_Y + PUZZLE_GRID_SIZE + 8;

const WEATHER_X = 276;
const WEATHER_WIDTH = 287;
const WEATHER_Y = 296;
const WEATHER_HEIGHT = 446;

const TV_Y = PAGE_MARGIN_BOTTOM;
const TV_HEIGHT = 252;

const BOXES = {
  tv: { x: PAGE_MARGIN_X, y: TV_Y, width: 531, height: TV_HEIGHT },
  weather: { x: WEATHER_X, y: WEATHER_Y, width: WEATHER_WIDTH, height: WEATHER_HEIGHT }
};
```

Current typography constants:

```js
const ABSOLUTE_MIN_MEANINGFUL_FONT = 8.5;
const FONT = {
  title: 31,
  date: 12.5,
  sectionTitle: 14.5,
  puzzleLabel: 13.5,
  difficulty: 9,
  sudokuNumber: 14.15,
  weatherPrimary: 12.5,
  weatherBody: 9.4,
  weatherMeta: 8.8,
  tvSectionTitle: 13.5,
  tvChannel: 10.5,
  tvTime: 9.5,
  tvTitle: 9.2,
  sourceFooter: 7.5
};
```

The `sourceFooter` value is not used in the current print layout. Meaningful printed content uses the 8.5 pt floor.

## Page Assembly

The page is built in `buildSudokuPdfBytes()`, which resolves one or two puzzle objects, builds the PDF content stream, and wraps it in a small PDF document.

```js
export function buildSudokuPdfBytes(puzzleData, displayDate = new Date(), options = {}) {
  const resolved = resolvePdfInputs(puzzleData, displayDate, options);
  const puzzles = resolvePdfPuzzles(resolved.puzzleData, resolved.options);
  const content = buildPageContent(puzzles, resolved.displayDate, resolved.options);

  return encodeAscii(buildPdfDocument(content));
}
```

The actual page assembly order:

```js
function buildPageContent(puzzles, displayDate, options = {}) {
  const cellSize = PUZZLE_GRID_SIZE / 9;
  const numberSize = FONT.sudokuNumber;
  const operations = [];

  operations.push('q');
  operations.push('0 0 0 RG');
  operations.push('0 0 0 rg');

  drawText(operations, options.title || "Jenny's Sudoku", A4_WIDTH / 2, TITLE_Y, FONT.title, 'F3', 'center');
  drawText(operations, displayDateLabel(displayDate), A4_WIDTH / 2, DATE_Y, FONT.date, 'F1', 'center');
  drawDottedLine(operations, PAGE_MARGIN_X, TITLE_RULE_Y, A4_WIDTH - PAGE_MARGIN_X, TITLE_RULE_Y, 0.75, 4);

  drawPuzzlePanel(operations, puzzles[0], {
    gridX: PUZZLE_GRID_X,
    gridY: PUZZLE_ONE_GRID_Y,
    labelY: PUZZLE_ONE_LABEL_Y,
    cellSize,
    numberSize
  });

  if (puzzles[1]) {
    drawPuzzlePanel(operations, puzzles[1], {
      gridX: PUZZLE_GRID_X,
      gridY: PUZZLE_TWO_GRID_Y,
      labelY: PUZZLE_TWO_LABEL_Y,
      cellSize,
      numberSize
    });
  }

  withClippedBox(operations, BOXES.weather, () => {
    drawWeatherForecastPanel(operations, options.weather, weatherPdfLines(options.weather), BOXES.weather, options);
  }, options);
  withClippedBox(operations, BOXES.tv, () => {
    drawTvListingsBox(operations, options.tvListings, tvListingsPdfLines(options.tvListings), BOXES.tv, options);
  }, options);

  operations.push('Q');

  return `${operations.join('\n')}\n`;
}
```

The weather and TV boxes are clipped. Clipping is a safety net, not the main fitting strategy.

```js
function withClippedBox(operations, box, drawFn, options = {}) {
  operations.push('q');
  operations.push(`${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.width)} ${formatNumber(box.height)} re W n`);
  drawFn();
  operations.push('Q');

  if (options.debugBoxes || safeEnv('PDF_DEBUG_BOXES') === '1') {
    drawRect(operations, box.x, box.y, box.width, box.height, 0.35);
  }
}
```

Set `PDF_DEBUG_BOXES=1` to draw light outlines around clipped boxes during local render checks.

## Puzzle Rendering

The Sudoku grids are still the visual priority. Each grid is 204 pt wide, roughly 8 mm cells on A4.

```js
function drawPuzzlePanel(operations, puzzle, metrics) {
  drawText(operations, `Puzzle ${puzzle.number}`, metrics.gridX, metrics.labelY, FONT.puzzleLabel, 'F2', 'left');
  drawLabelPill(operations, puzzle.label, metrics.gridX + 78, metrics.labelY - 3, 118, 16);
  drawGrid(operations, metrics.gridX, metrics.gridY, PUZZLE_GRID_SIZE, metrics.cellSize);
  drawGivens(operations, puzzle.givens, metrics.gridX, metrics.gridY, metrics.cellSize, metrics.numberSize);
}

function drawLabelPill(operations, label, x, y, width, height) {
  drawFilledRect(operations, x, y, width, height, GREY.veryLightFill);
  drawRect(operations, x, y, width, height, 0.5);
  drawText(operations, label, x + width / 2, y + 4.4, FONT.difficulty, 'F2', 'center');
}

function drawGrid(operations, gridX, gridY, gridSize, cellSize) {
  for (let index = 0; index <= 9; index += 1) {
    if (index % 3 === 0) continue;
    const offset = index * cellSize;
    drawLine(operations, gridX + offset, gridY, gridX + offset, gridY + gridSize, 0.6);
    drawLine(operations, gridX, gridY + offset, gridX + gridSize, gridY + offset, 0.6);
  }

  for (let index = 0; index <= 9; index += 3) {
    const offset = index * cellSize;
    drawLine(operations, gridX + offset, gridY, gridX + offset, gridY + gridSize, 1.9);
    drawLine(operations, gridX, gridY + offset, gridX + gridSize, gridY + offset, 1.9);
  }
}
```

Trade-off: the difficulty label uses a fixed 118 pt pill. That keeps layout stable, but very long future labels would need truncation if added.

## Text Measurement And Fitting

`src/font-metrics.js` contains width tables for the standard PDF fonts used by the document:

- Helvetica
- Helvetica-Bold
- Times-Roman
- Times-Bold

The large static width maps are omitted here for readability. These are the exported functions:

```js
export function measureText(text, fontName, size) {
  const family = resolveFontFamily(fontName);
  let width = 0;

  for (const character of String(text || '')) {
    width += widthForCharacter(character, family);
  }

  return (width / 1000) * size;
}

export function truncateToWidth(text, fontName, size, maxWidth) {
  const cleanText = String(text || '');

  if (measureText(cleanText, fontName, size) <= maxWidth) {
    return { text: cleanText, truncated: false };
  }

  const ellipsis = '...';
  let result = cleanText;

  while (result.length > 0 && measureText(`${result.trimEnd()}${ellipsis}`, fontName, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return {
    text: result.length > 0 ? `${result.trimEnd()}${ellipsis}` : ellipsis,
    truncated: true
  };
}

export function wrapText(text, fontName, size, maxWidth, maxLines, options = {}) {
  const words = tokenizeForWrap(text).flatMap((word) => splitLongWord(word, fontName, size, maxWidth));
  const lines = [];
  let current = '';
  let truncated = false;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (measureText(candidate, fontName, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      const truncatedWord = truncateToWidth(word, fontName, size, maxWidth);
      lines.push(truncatedWord.text);
      truncated = truncated || truncatedWord.truncated;
      current = '';
    }

    if (lines.length >= maxLines) {
      truncated = true;
      current = '';
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current) {
    truncated = true;
  }

  if (truncated && options.ellipsis !== false && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const fitted = truncateToWidth(`${lines[lastIndex]}...`, fontName, size, maxWidth);
    lines[lastIndex] = fitted.text;
  }

  return {
    lines: lines.length > 0 ? lines : [''],
    truncated
  };
}
```

The PDF renderer adds a text-box primitive on top of its internal wrapper:

```js
function drawTextBox(operations, config, options = {}) {
  const {
    align = 'left',
    font = 'F1',
    height,
    lineHeight,
    maxLines = Math.max(1, Math.floor(height / lineHeight)),
    minSize = ABSOLUTE_MIN_MEANINGFUL_FONT,
    overflow = 'ellipsis',
    overflowKey = 'text-box',
    size,
    text,
    width,
    x,
    y
  } = config;
  const finalSize = Math.max(size, minSize);
  const lineCount = Math.max(1, Math.min(maxLines, Math.floor(height / lineHeight) || maxLines));
  const wrapped =
    overflow === 'ellipsis'
      ? wrapPdfText(text, width, finalSize, lineCount, { fontName: font, allowTruncate: true })
      : { lines: wrapPdfText(text, width, finalSize, lineCount, { fontName: font, allowTruncate: false }).lines, truncated: false };

  wrapped.lines.slice(0, lineCount).forEach((line, index) => {
    drawText(operations, line, textBoxAlignedX(line, x, width, font, finalSize, align), y - index * lineHeight, finalSize, font, 'left');
  });

  const meta = {
    fitted: !wrapped.truncated,
    truncated: wrapped.truncated,
    usedLines: wrapped.lines.length,
    finalFontSize: finalSize
  };

  if (meta.truncated && Array.isArray(options.overflowLog)) {
    options.overflowLog.push({ key: overflowKey, text: cleanPdfText(text), ...meta });
  }

  return meta;
}
```

Text cleaning now normalizes common non-ASCII punctuation and accents instead of replacing them with `?`:

```js
function cleanPdfText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}
```

Trade-off: this keeps the PDF ASCII-only and compatible with the simple writer, but it loses true accents and typographic punctuation.

## Weather Data And Rendering

Weather comes from Open-Meteo first, wttr.in second, and stale cache last. The Open-Meteo request currently asks for four forecast days:

```js
const WEATHER_DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'sunshine_duration',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'uv_index_max',
  'et0_fao_evapotranspiration',
  'sunrise',
  'sunset'
];

const WEATHER_HOURLY_FIELDS = [
  'weather_code',
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day'
];
```

Weather is normalized into day objects like this:

```json
{
  "dateIso": "2026-06-19",
  "label": "Cloudy but dry most of the day",
  "icon": "partly-cloudy",
  "highC": 21,
  "lowC": 11,
  "precipitationSumMm": 0.4,
  "precipitationProbabilityMax": 36,
  "sunshineHours": 5,
  "windSpeedMph": 9,
  "windGustMph": 15,
  "sunrise": "04:49",
  "sunset": "21:20",
  "gardenSummary": {
    "rainSummary": "Mostly dry",
    "windSummary": "Light wind",
    "sunSummary": "About 5 hours of sun",
    "frostSummary": "No frost risk",
    "wateringSummary": "Water pots if soil is dry",
    "bestGardenTime": "Best garden time: morning"
  }
}
```

The garden summary is deliberately plain-English:

```js
function gardenRainLabel(probabilityMax, precipitationSum, rainyPeriods) {
  if (precipitationSum != null && precipitationSum >= 8) return 'Wet day';
  if (probabilityMax != null && probabilityMax >= 70) return `Rain likely ${periodText(rainyPeriods)}`;
  if (probabilityMax != null && probabilityMax >= 40) return `Showers possible ${periodText(rainyPeriods)}`;
  if (precipitationSum != null && precipitationSum >= 1) return 'A little rain possible';
  return 'Mostly dry';
}

function gardenWindLabel(maxGustMph) {
  if (maxGustMph == null) return 'Light wind';
  if (maxGustMph >= 35) return 'Very windy - secure pots';
  if (maxGustMph >= 25) return 'Windy';
  if (maxGustMph >= 16) return 'Breezy';
  return 'Light wind';
}

function gardenWateringLabel({ precipitationSumMm, precipitationProbabilityMax, highC, sunshineHours, windSummary }) {
  if ((precipitationSumMm != null && precipitationSumMm >= 3) || (precipitationProbabilityMax != null && precipitationProbabilityMax >= 70)) {
    return 'No watering needed';
  }

  if ((highC != null && highC >= 24) || (sunshineHours != null && sunshineHours >= 6) || /windy/i.test(windSummary || '')) {
    return 'Check pots this evening';
  }

  if (precipitationProbabilityMax != null && precipitationProbabilityMax < 30) {
    return 'Water pots if soil is dry';
  }

  return 'Probably no need to water';
}
```

The renderer displays:

- A section title: `Weather for the garden`.
- A larger Today feature box with high/low, condition, rain, wind, and garden line.
- Three compact forecast rows.
- A small sunrise/sunset footer.

The route-date bug is covered: `selectWeatherForecast()` slices `weather.days` so a requested forecast date becomes the first displayed day.

## TV Data And Rendering

Freely TV data is normalized into five fixed channels:

```js
const TV_CHANNELS = [
  { serviceId: '37123', name: 'BBC One South' },
  { serviceId: '37184', name: 'BBC Two' },
  { serviceId: '37641', name: 'ITV1' },
  { serviceId: '37889', name: 'Channel 4' },
  { serviceId: '38145', name: '5' }
];
```

Normalized channel shape:

```json
{
  "dateIso": "2026-06-19",
  "sourceLabel": "TV: Freely",
  "timeZone": "Europe/London",
  "windowLabel": "19:00-23:00",
  "channels": [
    {
      "serviceId": "37123",
      "name": "BBC One South",
      "programs": [
        { "startTime": "18:30", "title": "Antiques Road Trip", "startedBeforeWindow": true },
        { "startTime": "19:30", "title": "EastEnders" }
      ]
    }
  ]
}
```

The overlap rule is:

```js
program.startMs < windowEndMs && program.endMs > windowStartMs
```

`endMs` uses explicit Freely `duration` when available, clamps to the next programme start if a duration overlaps the next event, and otherwise falls back to one hour.

```js
const normalizedEvents = events
  .map((event) => normalizeFreelyEvent(event))
  .filter(Boolean)
  .sort((left, right) => left.startMs - right.startMs)
  .map((program, index, allPrograms) => {
    const nextStartMs = allPrograms[index + 1]?.startMs;
    const durationEndMs = program.durationMs ? program.startMs + program.durationMs : null;
    let endMs = durationEndMs ?? nextStartMs ?? program.startMs + 60 * 60 * 1000;

    if (nextStartMs && nextStartMs > program.startMs && durationEndMs && durationEndMs > nextStartMs) {
      endMs = nextStartMs;
    }

    return { ...program, endMs };
  });
```

The active PDF TV layout is channel bands:

```js
export function layoutTvChannelBandsForPdf(tvListings, box) {
  const innerX = box.x + 7;
  const innerWidth = box.width - 14;
  const titleHeight = 31;
  const rowHeight = (box.height - titleHeight - 11) / TV_CHANNEL_COUNT;
  const channelLabelWidth = 65;
  const lineHeight = 12.2;
  const rows = normalizeTvChannels(tvListings).map((channel, index) => {
    const rowY = box.y + box.height - titleHeight - (index + 1) * rowHeight;
    const programmeWidth = innerWidth - channelLabelWidth - 4;
    const fitted = layoutInlineProgrammeRows(channel.programs || [], {
      maxLines: 2,
      width: programmeWidth
    });

    return {
      x: innerX,
      y: rowY,
      width: innerWidth,
      height: rowHeight,
      heading: pdfChannelHeading(channel.name || `Channel ${index + 1}`),
      programmeX: innerX + channelLabelWidth,
      programmeWidth,
      lineHeight,
      lines: fitted.lines,
      overflowCount: fitted.overflowCount,
      truncatedCount: fitted.truncatedCount
    };
  });

  return {
    rows,
    mode: 'channelBands',
    truncatedCount: rows.reduce((total, row) => total + row.truncatedCount, 0),
    overflowCount: rows.reduce((total, row) => total + row.overflowCount, 0)
  };
}
```

Inline programme fitting works with rich text segments: bold time, regular title, and spacer width. If the row is too dense, it replaces remaining whole programme groups with `+n later`.

```js
function layoutInlineProgrammeRows(programs, metrics) {
  const sourcePrograms = Array.isArray(programs) && programs.length > 0 ? programs : [{ title: 'No listings' }];
  const lines = [createProgrammeLine()];
  let truncatedCount = 0;
  let overflowCount = 0;

  for (let index = 0; index < sourcePrograms.length; index += 1) {
    const programme = sourcePrograms[index];
    const remainingPrograms = sourcePrograms.length - index;
    const candidate = buildProgrammeSegments(programme, metrics.width);
    let line = lines[lines.length - 1];

    if (line.segments.length > 0 && line.width + candidate.width > metrics.width && lines.length < metrics.maxLines) {
      line = createProgrammeLine();
      lines.push(line);
    }

    if (line.width + candidate.width <= metrics.width) {
      appendProgrammeGroup(line, candidate);
      truncatedCount += candidate.truncated ? 1 : 0;
      continue;
    }

    const availableWidth = Math.max(24, metrics.width - line.width);
    const fitted = buildProgrammeSegments(programme, availableWidth, { forceFit: true });

    if (line.width + fitted.width <= metrics.width) {
      appendProgrammeGroup(line, fitted);
      truncatedCount += 1;
      continue;
    }

    overflowCount = appendLaterSegment(line, metrics.width, remainingPrograms);
    break;
  }

  return { lines, overflowCount, truncatedCount };
}
```

```js
function appendLaterSegment(line, width, count) {
  let resolvedCount = count;
  let text = `+${resolvedCount} later`;
  let segmentWidth = measureText(text, 'F2', FONT.tvTime);

  while (line.width + segmentWidth > width && line.segments.length > 0) {
    const removedGroup = line.groups.pop();
    if (!removedGroup) break;
    line.segments.splice(-removedGroup.segments.length, removedGroup.segments.length);
    line.width -= removedGroup.width;
    resolvedCount += 1;
    text = `+${resolvedCount} later`;
    segmentWidth = measureText(text, 'F2', FONT.tvTime);
  }

  if (line.width + segmentWidth > width) return resolvedCount;

  line.segments.push({ text, font: 'F2', size: FONT.tvTime, width: segmentWidth });
  line.width += segmentWidth;
  return resolvedCount;
}
```

There is still a five-column layout function in `src/pdf.js` (`layoutTvListingsForPdf`) for fallback compatibility and tests, but `TV_LAYOUT_MODE` is currently set to `channelBands`.

## Example Combined Render Inputs

The PDF builder expects already-generated Sudoku data plus optional normalized weather and TV data:

```js
buildSudokuPdfBytes(puzzle, '2026-06-19', {
  title: "Jenny's Sudoku",
  weather: {
    days: [
      {
        dateIso: '2026-06-19',
        icon: 'partly-cloudy',
        label: 'Cloudy but dry most of the day',
        highC: 21,
        lowC: 11,
        sunrise: '04:49',
        sunset: '21:20',
        gardenSummary: {
          rainSummary: 'Mostly dry',
          windSummary: 'Light wind',
          wateringSummary: 'Water pots if soil is dry'
        }
      }
    ]
  },
  tvListings: {
    channels: [
      {
        name: 'BBC One South',
        programs: [
          { startTime: '18:30', startedBeforeWindow: true, title: 'Antiques Road Trip' },
          { startTime: '19:30', title: 'EastEnders' }
        ]
      }
    ]
  }
});
```

## Tests And Current Coverage

Current tests cover:

- A4 PDF structure and expected text content.
- Two-puzzle layout with current hard puzzle labels.
- Channel-band TV layout.
- Dense TV overflow with `+n later`.
- Guard against orphaned times before `+n later`.
- Freely programmes that overlap 19:00 due to duration.
- Exclusion of programmes starting exactly at 23:00.
- Weather URL field expansion.
- Garden-summary normalization.
- Requested forecast date becoming the first display day.
- Server raw PDF routes.

Remaining coverage gaps worth considering:

- Rendered-PNG assertions in CI rather than manual local render checks.
- Fixture for very long weather labels/garden notes in the actual PDF renderer.
- Fixture for unavailable weather and unavailable TV in one combined PDF.
- Automated detection that every text box either fits or logs truncation.
- More exact PDF font metrics if the visual fit still disagrees with macOS Preview.

## Design Decisions And Trade-offs

- The Sudoku grids were not significantly shrunk because they are the main product and the current cell size is comfortable on paper.
- The TV box keeps the same general bottom footprint because prior print proofs were tuned around top/bottom clipping.
- Weather now emphasizes today because the recipient likely cares more about immediate garden decisions than equal four-day cards.
- The PDF remains monochrome and path/icon based to keep printing cheap and reliable.
- We kept the simple no-dependency PDF writer; this makes rendering deterministic but requires our own text measurement and manual layout.
- We use truncation and `+n later` rather than shrinking below 8.5 pt.
- Clipping is used to prevent section spillover during unattended printing, but clipping is not treated as a substitute for fitting.

## Questions For The Analyst

1. Does the current Today-plus-three weather panel use the right amount of space relative to the puzzles?
2. Would the Today weather box be clearer with different ordering, for example rain/wind/garden before the condition label?
3. Are the channel-band TV rows easier to scan than the previous five-column layout?
4. Should any TV programmes that start at 23:00 be included despite the `7-11pm` title, or is exclusion correct?
5. Is the `+n later` marker clear enough for dense TV nights?
6. Are the font sizes and line weights appropriate for draft-quality grayscale printing?
7. Would the page benefit from a subtle source/date footer, or would that add clutter?
8. Should the weather panel include frost or sunshine details on the printout, or keep those internal?
9. Should we invest in a stronger PDF rendering library, or is the current hand-built PDF appropriate for this fixed one-page use case?
10. What changes would make the sheet feel more beautiful without making it ink-heavy or reducing puzzle usability?
