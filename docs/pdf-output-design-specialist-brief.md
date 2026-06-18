# Jenny's Sudoku Daily Print PDF - Design Specialist Brief

Generated: 2026-06-18

## Purpose

This document is for a design specialist reviewing the one-page A4 PDF that prints every morning for Jenny. The page is a daily ritual sheet: two Sudoku puzzles first, then practical local weather for gardening, then evening TV listings. It must work unattended, print cheaply in black-and-white draft mode, and remain readable for an older adult using a physical printout.

The current proof PDF path is:

- `tmp/pdfs/jenny-layout-proof.pdf`

The rendered proof image path is:

- `tmp/pdf-renders/jenny-layout-proof.pdf.png`

## Product Goals

- Keep the whole output on one A4 portrait page.
- Keep both Sudoku grids large enough to solve comfortably by pen.
- Show two puzzles per day, normally `Very Difficult` and `Fiendish`, with harder weekend targets where available.
- Keep the weather panel practical for gardening rather than data-heavy.
- Keep the TV listings easy to scan from 7pm to 11pm.
- Stay monochrome and low-ink: light rules, small grey fills, no colour blocks, no photos.
- Avoid fragile unattended-print failures: no overlap, no clipping, no tiny user-facing text.

## Target Audience

Jenny is the end user. She receives this as a printed sheet, not as an interactive web page. The printout should feel calm, legible, and newspaper-like. It should not feel like a dense admin report or a decorative poster. The Sudoku grids are the core feature; weather and TV are useful supporting information.

## Non-Negotiable Print Rules

- Meaningful content should not go below 8.5 pt.
- Normal body/listing text should be around 9.0-9.6 pt where possible.
- Footer/debug/source text may be smaller, but current print output avoids source footers.
- No `On now` wording: the sheet is printed in the morning, so TV programmes that began before 7pm show their real start time, such as `6.30`.
- TV programme time and title must remain visually attached.
- Long TV names should truncate or collapse to `+n later`, not force tiny text.
- Weather sunrise/sunset/daylight text must be useful and readable, not stranded as a tiny footer.
- The layout should remain black-and-white and draft-printer friendly.

## Current Page Structure

The renderer uses fixed named layout boxes in PDF points:

- Page: A4 portrait, `595.28 x 841.89` pt.
- Margins: about `32` pt left/right and `30` pt top/bottom.
- Header: title, date, dotted rule.
- Left column: two Sudoku grids, each `204` pt square.
- Right column: weather panel above the TV guide.
- Bottom box: horizontal TV channel-band layout.

The TV box footprint is deliberately stable because the daily print job has already been tuned to avoid printer clipping at the top and bottom.

## Current Visual Direction

The current page uses:

- Times-Bold for the main title.
- Helvetica/Helvetica-Bold for functional labels and listings.
- Thin rules and dotted separators.
- Very light grey fills for the Today weather card, difficulty pills, TV heading strip, and TV channel rail.
- Simple PDF path-drawn weather icons.
- No external images, colour, or heavy assets.

The current design is intentionally more utilitarian than decorative. The next visual opportunity is to make it feel more polished and newspaper-like without reducing legibility or increasing ink usage.

## Current Normalized Weather Data Shape

The weather code receives normalized daily weather data from Open-Meteo or wttr.in fallback. The PDF renderer expects this kind of shape:

```json
{
  "days": [
    {
      "dateIso": "2026-06-18",
      "icon": "cloud",
      "label": "Mostly dry, cloudy",
      "highC": 21,
      "lowC": 11,
      "sunrise": "04:49",
      "sunset": "21:20",
      "gardenSummary": {
        "rainSummary": "Mostly dry",
        "windSummary": "Light wind",
        "wateringSummary": "Water pots if soil is dry",
        "sunSummary": "About 6 hours of sun",
        "bestGardenTime": "Best garden time: morning or lunchtime"
      }
    },
    {
      "dateIso": "2026-06-19",
      "icon": "rain",
      "label": "Light rain",
      "highC": 18,
      "lowC": 10,
      "gardenSummary": {
        "rainSummary": "Showers possible morning",
        "windSummary": "Breezy"
      }
    }
  ]
}
```

The PDF currently renders this as:

- A larger Today card.
- Rain, wind, garden, and daylight rows.
- Three compact future-day rows.
- A bottom practical note only when useful.

## Current Normalized TV Data Shape

The TV normalizer includes programmes that overlap the 19:00-23:00 viewing window. A programme starting before 19:00 is included if it is still running after 19:00, but the PDF displays the real start time.

```json
{
  "channels": [
    {
      "name": "BBC One South",
      "programs": [
        { "startTime": "18:30", "startedBeforeWindow": true, "title": "Antiques Road Trip" },
        { "startTime": "19:30", "title": "EastEnders" },
        { "startTime": "20:00", "title": "The Repair Shop" }
      ]
    },
    {
      "name": "5",
      "programs": [
        { "startTime": "19:00", "title": "5 News Tonight" },
        { "startTime": "21:00", "title": "Casualty 24/7: Every Second Counts" }
      ]
    }
  ]
}
```

The PDF currently renders this as horizontal channel bands:

```text
Tonight on TV - 7-11pm

BBC One    6.30 Antiques Road Trip   7.30 EastEnders   8.00 The Repair Shop
           9.00 Silent Witness       10.00 BBC News at Ten

Channel 5  7.00 5 News Tonight       8.00 Traffic Cops
           9.00 Casualty 24/7...     10.00 World's Wildest Weather
```

## Current Trade-Offs

- The Sudoku grids stay large. This limits how much weather and TV content can fit.
- The page is fixed-layout rather than dynamically reflowed. This is safer for unattended printing.
- The renderer uses built-in PDF Type 1 fonts instead of embedding custom fonts. This keeps the PDF small and dependency-free, but limits typography.
- Text measurement is approximate but font-specific. It is much better than fixed character counts, but it is still not a full shaping engine.
- Long TV listings are intentionally dropped into `+n later` rather than squeezed below 8.5 pt.
- Weather uses plain-English garden summaries instead of technical forecast terms.
- Channel-band TV layout is more readable than five narrow columns, but it leaves some unused horizontal space on quiet evenings.

## Questions For The Design Specialist

1. How can we make this feel more beautiful and newspaper-like without adding colour or ink-heavy fills?
2. Are the title, puzzle labels, weather heading, and TV heading balanced correctly?
3. Should the difficulty labels remain as outlined pills, or should they become inline text such as `Puzzle 1 - Very Difficult`?
4. Is the weather Today card too large, too plain, or about right for the gardening use case?
5. Would the future weather rows benefit from different spacing, dividers, or typography?
6. Does the horizontal TV guide feel easy to scan, or should the channel rail/programme rhythm change?
7. Are there any obvious print-readability problems for an older adult using draft quality?
8. Are there better low-ink ways to create visual hierarchy than light grey fills and dotted rules?
9. Should the bottom TV box or weather panel include any small decorative rule work, or should it stay austere?
10. What should we remove if the page still feels crowded?

## Full PDF Renderer Code

Source: `src/pdf.js`

```js
import { measureText, truncateToWidth } from './font-metrics.js';
import { weatherPdfLines } from './weather.js';
import { formatTvDisplayTime, tvListingsPdfLines } from './tv-listings.js';

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
const WEATHER_TOP = WEATHER_Y + WEATHER_HEIGHT;
const TV_Y = PAGE_MARGIN_BOTTOM;
const TV_HEIGHT = 252;
const TV_CHANNEL_COUNT = 5;
const TV_INNER_PADDING_X = 10;
const TV_INNER_PADDING_Y = 8;
const TV_COLUMN_GAP = 10;
const MAX_PROGRAMME_FONT = 10.7;
const MIN_PROGRAMME_FONT = 8.5;
const PROGRAMME_FONT_STEP = 0.25;
const MAX_CHANNEL_FONT = 11.4;
const PROGRAMME_TRUNCATE_AFTER_CHARS = 45;
const PROGRAMME_TIME_FONT_SCALE = 0.86;
const PROGRAMME_TIME_TITLE_GAP = 5;
const TV_CHANNEL_LABEL_WIDTH = 68;
const TV_CHUNK_GAP = 10;
const TV_LINE_HEIGHT = 10.9;
const TV_LAYOUT_MODE = 'channelBands';
const PDF_MIME_TYPE = 'application/pdf';
const DATE_KEY_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;
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
  weatherMeta: 9,
  tvSectionTitle: 14,
  tvChannel: 10.2,
  tvTime: 8.9,
  tvTitle: 9.2,
  sourceFooter: 7.5
};
const GREY = {
  black: 0,
  dark: 0.25,
  mid: 0.55,
  rule: 0.7,
  lightFill: 0.93,
  veryLightFill: 0.97,
  white: 1
};
const BOXES = {
  tv: {
    x: PAGE_MARGIN_X,
    y: TV_Y,
    width: 531,
    height: TV_HEIGHT
  },
  weather: {
    x: WEATHER_X,
    y: WEATHER_Y,
    width: WEATHER_WIDTH,
    height: WEATHER_HEIGHT
  }
};

export { A4_HEIGHT, A4_WIDTH, CONTENT_WIDTH };

export function sudokuPdfFilename(displayDate = new Date()) {
  return `sudoku-${dateKeyFrom(displayDate)}.pdf`;
}

export function buildSudokuPdf(puzzleData, displayDate = new Date(), options = {}) {
  const bytes = buildSudokuPdfBytes(puzzleData, displayDate, options);

  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: PDF_MIME_TYPE });
  }

  return bytes;
}

export function buildSudokuPdfBytes(puzzleData, displayDate = new Date(), options = {}) {
  const resolved = resolvePdfInputs(puzzleData, displayDate, options);
  const puzzles = resolvePdfPuzzles(resolved.puzzleData, resolved.options);
  const content = buildPageContent(puzzles, resolved.displayDate, resolved.options);

  return encodeAscii(buildPdfDocument(content));
}

export default buildSudokuPdf;

function resolvePdfInputs(puzzleData, displayDate, options) {
  if (puzzleData && typeof puzzleData === 'object' && !Array.isArray(puzzleData) && 'puzzle' in puzzleData) {
    return {
      puzzleData,
      displayDate: puzzleData.displayDate || puzzleData.formattedDate || puzzleData.dateIso || puzzleData.date || displayDate,
      options: {
        ...options,
        title: puzzleData.title || options.title,
        weather: puzzleData.weather || options.weather,
        tvListings: puzzleData.tvListings || options.tvListings
      }
    };
  }

  return { puzzleData, displayDate, options };
}

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

function resolvePdfPuzzles(puzzleData, options = {}) {
  const sourcePuzzles = Array.isArray(options.puzzles)
    ? options.puzzles
    : Array.isArray(puzzleData?.puzzles)
      ? puzzleData.puzzles
      : null;

  if (sourcePuzzles && sourcePuzzles.length > 0) {
    return sourcePuzzles.slice(0, 2).map((puzzle, index) => ({
      number: puzzle.number || index + 1,
      label: puzzle.label || puzzle.difficulty || 'Puzzle',
      givens: extractGivens(puzzle)
    }));
  }

  return [
    {
      number: 1,
      label: puzzleData?.label || puzzleData?.difficulty || options.difficulty || 'Puzzle',
      givens: extractGivens(puzzleData)
    }
  ];
}

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

function drawWeatherForecastPanel(operations, weather, fallbackLines, box, options = {}) {
  const { x, y, width, height } = box;
  const top = y + height;
  const titleY = top - 17;
  drawWeatherIcon(operations, 'partly-cloudy', x + 16, titleY + 1, 10);
  drawText(operations, 'Weather for the garden', x + 34, titleY - 3, FONT.sectionTitle, 'F2', 'left');
  drawDottedLine(operations, x, top - 31, x + width, top - 31, 0.6, 3);

  if (!weather || weather.unavailable || !Array.isArray(weather.days) || weather.days.length === 0) {
    const lines = fallbackLines.filter((line) => !/^Christchurch weather\b/i.test(line));
    drawTextBox(operations, {
      text: lines.length > 0 ? lines.join(' ') : 'Weather forecast unavailable',
      x: x + 8,
      y: top - 45,
      width: width - 16,
      height: height - 50,
      font: 'F1',
      size: FONT.weatherBody,
      lineHeight: 11,
      maxLines: 6,
      overflowKey: 'weather-unavailable'
    }, options);
    return;
  }

  const days = weather.days.slice(0, 4);
  const today = days[0];
  const todayBox = {
    x,
    y: top - 190,
    width,
    height: 150
  };

  drawTodayWeatherBox(operations, today, todayBox, options);

  const rowHeight = 54;
  const rowGap = 5;
  days.slice(1, 4).forEach((day, index) => {
    drawWeatherDayRow(operations, day, {
      x,
      y: todayBox.y - 12 - index * (rowHeight + rowGap) - rowHeight,
      width,
      height: rowHeight
    }, options);
  });

  const bottomNote = weatherBottomGardenNote(today);
  if (bottomNote) {
    drawWeatherBottomNote(operations, bottomNote, {
      x,
      y: y + 8,
      width,
      height: 42
    }, options);
  }
}

function drawTodayWeatherBox(operations, day, box, options) {
  const { x, y, width, height } = box;
  const summary = weatherGardenSummary(day);
  const daylight = weatherDaylightSummary(day);

  drawFilledRect(operations, x, y, width, height, GREY.veryLightFill);
  drawRect(operations, x, y, width, height, 0.55);
  drawText(operations, 'TODAY', x + 10, y + height - 18, 12.4, 'F2', 'left');
  drawWeatherIcon(operations, day.icon, x + 35, y + height - 56, 18);
  drawText(operations, `High ${temperatureNumber(day.highC)} / Low ${temperatureNumber(day.lowC)}`, x + width - 10, y + height - 18, FONT.weatherMeta, 'F2', 'right');
  drawTextBox(operations, {
    text: day.label || 'Forecast',
    x: x + 72,
    y: y + height - 38,
    width: width - 86,
    height: 26,
    font: 'F1',
    size: FONT.weatherBody,
    lineHeight: 11,
    maxLines: 2,
    overflowKey: 'weather-today-condition'
  }, options);

  drawDottedLine(operations, x + 10, y + 66, x + width - 10, y + 66, 0.4, 2.5);
  drawWeatherSummaryLine(operations, 'Rain', summary.rainSummary, x + 10, y + 52, width - 20, options);
  drawWeatherSummaryLine(operations, 'Wind', summary.windSummary, x + 10, y + 39, width - 20, options);
  drawWeatherSummaryLine(operations, 'Garden', summary.wateringSummary, x + 10, y + 26, width - 20, options);
  if (daylight) {
    drawWeatherSummaryLine(operations, 'Daylight', daylight, x + 10, y + 13, width - 20, options);
  }
}

function drawWeatherSummaryLine(operations, label, value, x, y, width, options) {
  const labelWidth = 56;
  drawText(operations, `${label}:`, x, y, FONT.weatherMeta, 'F2', 'left');
  drawTextBox(operations, {
    text: value || 'No detail',
    x: x + labelWidth,
    y,
    width: width - labelWidth,
    height: 11,
    font: 'F1',
    size: FONT.weatherMeta,
    lineHeight: 10.4,
    maxLines: 1,
    overflowKey: `weather-${label.toLowerCase()}`
  }, options);
}

function drawWeatherDayRow(operations, day, box, options) {
  const { x, y, width, height } = box;
  const summary = weatherGardenSummary(day);
  const label = shortWeatherRowDayLabel(day.dateIso);

  drawLine(operations, x, y, x + width, y, 0.35);
  drawText(operations, label, x + 9, y + height - 17, FONT.weatherBody, 'F2', 'left');
  drawWeatherIcon(operations, day.icon, x + 54, y + height - 27, 11);
  drawText(operations, shortTemperature(day), x + 84, y + height - 17, FONT.weatherMeta, 'F2', 'left');
  drawTextBox(operations, {
    text: summary.rainSummary,
    x: x + 132,
    y: y + height - 18,
    width: width - 140,
    height: 12,
    font: 'F1',
    size: FONT.weatherMeta,
    lineHeight: 10.4,
    maxLines: 1,
    overflowKey: 'weather-row-rain'
  }, options);
  drawTextBox(operations, {
    text: summary.windSummary,
    x: x + 132,
    y: y + height - 32,
    width: width - 140,
    height: 12,
    font: 'F1',
    size: FONT.weatherMeta,
    lineHeight: 10.4,
    maxLines: 1,
    overflowKey: 'weather-row-wind'
  }, options);
}

function drawWeatherBottomNote(operations, note, box, options) {
  drawLine(operations, box.x + 4, box.y + box.height, box.x + box.width - 4, box.y + box.height, 0.35);
  drawTextBox(operations, {
    text: note,
    x: box.x + 8,
    y: box.y + box.height - 14,
    width: box.width - 16,
    height: box.height - 10,
    font: 'F2',
    size: 9.2,
    lineHeight: 11,
    maxLines: 2,
    overflowKey: 'weather-bottom-note'
  }, options);
}

function drawLineBox(operations, x, y, width, height) {
  drawLine(operations, x, y, x + width, y, 0.6);
  drawLine(operations, x, y + height, x + width, y + height, 0.6);
  drawLine(operations, x, y, x, y + height, 0.6);
  drawLine(operations, x + width, y, x + width, y + height, 0.6);
}

function drawInfoLines(operations, lines, x, y, width, lineGap, maxLines = 8) {
  const textLines = lines.slice(0, maxLines);
  textLines.forEach((line, index) => {
    const font = index === 0 ? 'F2' : 'F1';
    const size = index === 0 ? FONT.weatherMeta : ABSOLUTE_MIN_MEANINGFUL_FONT;
    drawText(operations, truncatePdfText(line, width, size), x, y - index * lineGap, size, font, 'left');
  });
}

function drawTvListingsBox(operations, tvListings, fallbackLines, box) {
  const { x, y, width, height } = box;
  drawLineBox(operations, x, y, width, height);
  drawFilledRect(operations, x + 0.5, y + height - 26, width - 1, 25.5, GREY.veryLightFill);
  drawText(operations, 'Tonight on TV - 7-11pm', x + 9, y + height - 17, FONT.tvSectionTitle, 'F2', 'left');
  drawDottedLine(operations, x + 7, y + height - 30, x + width - 7, y + height - 30, 0.35, 2.5);

  if (!tvListings || tvListings.unavailable || !Array.isArray(tvListings.channels)) {
    const cleanedLines = fallbackLines.filter((line) => !/^Tonight on TV\b/i.test(line));
    const lines = cleanedLines.length > 0 ? cleanedLines : ['TV listings unavailable'];
    drawInfoLines(operations, lines, x + 10, y + height - 42, width - 20, 11, 10);
    return;
  }

  if (TV_LAYOUT_MODE === 'channelBands') {
    drawTvChannelBands(operations, tvListings, box);
    return;
  }

  const layout = layoutTvListingsForPdf(tvListings, box);
  const firstColumn = layout.columns[0];

  if (firstColumn) {
    drawDottedLine(operations, x + 6, y + height - 35, x + width - 6, y + height - 35, 0.35, 2.5);
  }

  layout.columns.slice(1).forEach((column) => {
    const separatorX = column.x - TV_COLUMN_GAP / 2;
    drawLine(operations, separatorX, y + 5, separatorX, y + height - 5, 0.35);
  });

  layout.columns.forEach((column) => {
    const channelFontSize = column.channelFontSize || layout.channelFontSize;
    const programmeFontSize = column.programmeFontSize || layout.programmeFontSize;
    const programmeLineHeight = column.programmeLineHeight || layout.programmeLineHeight;
    const headingLineHeight = column.headingLineHeight || layout.headingLineHeight;
    const headingToListingsGap = column.headingToListingsGap || layout.headingToListingsGap;
    const entryGap = column.entryGap || layout.entryGap;
    let cursorY = column.yTop - channelFontSize;

    column.headingLines.forEach((line) => {
      drawText(operations, line, column.x, cursorY, channelFontSize, 'F2', 'left');
      cursorY -= headingLineHeight;
    });

    cursorY -= headingToListingsGap;

    column.entries.forEach((entry) => {
      entry.lines.forEach((line, lineIndex) => {
        const titleX = column.x + (entry.lineXOffsets?.[lineIndex] ?? entry.titleXOffset ?? 0);

        if (lineIndex === 0 && entry.time) {
          drawText(
            operations,
            entry.time,
            column.x,
            cursorY,
            entry.timeFontSize || programmeFontSize * PROGRAMME_TIME_FONT_SCALE,
            'F2',
            'left'
          );
        }

        if (line) {
          drawText(operations, line, titleX, cursorY, programmeFontSize, 'F1', 'left');
        }
        cursorY -= programmeLineHeight;
      });
      cursorY -= entryGap;
    });
  });
}

function drawTvChannelBands(operations, tvListings, box) {
  const layout = layoutTvChannelBandsForPdf(tvListings, box);

  layout.rows.forEach((row) => {
    drawFilledRect(operations, row.x, row.y + 0.35, row.programmeX - row.x - 4, row.height - 0.7, GREY.veryLightFill);
    drawLine(operations, row.x, row.y, row.x + row.width, row.y, 0.35);
    drawText(operations, row.heading, row.x + 8, row.y + row.height - 17, FONT.tvChannel, 'F2', 'left');

    row.lines.forEach((line, lineIndex) => {
      let cursorX = row.programmeX;
      const cursorY = row.y + row.height - 17 - lineIndex * row.lineHeight;

      line.segments.forEach((segment) => {
        if (!segment.spacer) {
          drawText(operations, segment.text, cursorX, cursorY, segment.size, segment.font, 'left');
        }
        cursorX += segment.width;
      });
    });
  });
}

export function layoutTvChannelBandsForPdf(tvListings, box) {
  const innerX = box.x + 7;
  const innerY = box.y + 7;
  const innerWidth = box.width - 14;
  const titleHeight = 32;
  const rowHeight = (box.height - titleHeight - 11) / TV_CHANNEL_COUNT;
  const channelLabelWidth = TV_CHANNEL_LABEL_WIDTH;
  const lineHeight = TV_LINE_HEIGHT;
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

  return {
    lines,
    overflowCount,
    truncatedCount
  };
}

function createProgrammeLine() {
  return {
    groups: [],
    segments: [],
    width: 0
  };
}

function appendProgrammeGroup(line, group) {
  line.groups.push(group);
  line.segments.push(...group.segments);
  line.width += group.width;
}

function buildProgrammeSegments(programme, maxWidth, options = {}) {
  const time = tvProgrammeTimeLabel(programme);
  const title = cleanPdfText(programme?.title || 'Untitled');
  const timeText = time || '';
  const timeWidth = measureText(timeText, 'F2', FONT.tvTime);
  const separatorWidth = title && time ? measureText(' ', 'F1', FONT.tvTitle) : 0;
  const titleMaxWidth = Math.max(18, maxWidth - timeWidth - separatorWidth - TV_CHUNK_GAP);
  const fittedTitle = options.forceFit
    ? truncateToWidth(title, 'F1', FONT.tvTitle, titleMaxWidth)
    : { text: title, truncated: false };
  const titleWidth = measureText(fittedTitle.text, 'F1', FONT.tvTitle);
  const segments = [];

  if (timeText) {
    segments.push({
      text: timeText,
      font: 'F2',
      size: FONT.tvTime,
      width: timeWidth
    });
  }

  if (separatorWidth > 0) {
    segments.push({
      text: '',
      font: 'F1',
      size: FONT.tvTitle,
      width: separatorWidth,
      spacer: true
    });
  }

  if (fittedTitle.text) {
    segments.push({
      text: fittedTitle.text,
      font: 'F1',
      size: FONT.tvTitle,
      width: titleWidth
    });
  }

  segments.push({
    text: '',
    font: 'F1',
    size: FONT.tvTitle,
    width: TV_CHUNK_GAP,
    spacer: true
  });

  return {
    segments,
    truncated: fittedTitle.truncated,
    width: timeWidth + separatorWidth + titleWidth + TV_CHUNK_GAP
  };
}

function appendLaterSegment(line, width, count) {
  let resolvedCount = count;
  let text = `+${resolvedCount} later`;
  let segmentWidth = measureText(text, 'F2', FONT.tvTime);

  while (line.width + segmentWidth > width && line.segments.length > 0) {
    const removedGroup = line.groups.pop();
    if (!removedGroup) {
      break;
    }
    line.segments.splice(-removedGroup.segments.length, removedGroup.segments.length);
    line.width -= removedGroup.width;
    resolvedCount += 1;
    text = `+${resolvedCount} later`;
    segmentWidth = measureText(text, 'F2', FONT.tvTime);
  }

  if (line.width + segmentWidth > width) {
    return resolvedCount;
  }

  line.segments.push({
    text,
    font: 'F2',
    size: FONT.tvTime,
    width: segmentWidth
  });
  line.width += segmentWidth;
  return resolvedCount;
}

function tvProgrammeTimeLabel(programme) {
  if (!programme?.startTime) {
    return '';
  }

  return formatTvDisplayTime(programme.startTime).replace(':', '.');
}

export function layoutTvListingsForPdf(tvListings, box) {
  const fittedLayout = buildTvListingsLayout(tvListings, box, false);

  if (fittedLayout.fits) {
    return withoutFitFlag(fittedLayout);
  }

  return withoutFitFlag(buildTvListingsLayout(tvListings, box, true));
}

function buildTvListingsLayout(tvListings, box, forceCrowded) {
  const innerX = box.x + TV_INNER_PADDING_X;
  const innerY = box.y + TV_INNER_PADDING_Y;
  const innerWidth = box.width - TV_INNER_PADDING_X * 2;
  const innerHeight = box.height - TV_INNER_PADDING_Y * 2;
  const columnWidth = (innerWidth - TV_COLUMN_GAP * (TV_CHANNEL_COUNT - 1)) / TV_CHANNEL_COUNT;
  const channels = normalizeTvChannels(tvListings);
  let fits = true;
  let truncatedCount = 0;

  const columns = channels.map((channel, index) => {
    const columnX = innerX + index * (columnWidth + TV_COLUMN_GAP);
    const programs =
      Array.isArray(channel.programs) && channel.programs.length > 0
        ? channel.programs
        : [{ startTime: '', title: 'No listings' }];
    const columnFit = fitBestTvColumn(programs, {
      columnWidth,
      heading: pdfChannelHeading(channel.name || `Channel ${index + 1}`),
      innerHeight,
      forceCrowded
    });
    let entries = columnFit.entries;
    let requiredHeight = columnFit.requiredHeight;
    truncatedCount += columnFit.truncatedCount;

    if (!columnFit.fits) {
      fits = false;
    }

    const visibleEntries = forceCrowded
      ? entriesThatFit(columnFit.entries, {
          innerHeight,
          headingLineHeight: columnFit.headingLineHeight,
          headingLines: columnFit.headingLines,
          headingToListingsGap: columnFit.headingToListingsGap,
          programmeLineHeight: columnFit.programmeLineHeight,
          entryGap: columnFit.entryGap,
          columnWidth,
          programmeFontSize: columnFit.programmeFontSize
        })
      : entries;

    if (forceCrowded) {
      entries = visibleEntries;
      requiredHeight = columnRequiredHeight({
        entries: visibleEntries,
        headingLineHeight: columnFit.headingLineHeight,
        headingLines: columnFit.headingLines,
        headingToListingsGap: columnFit.headingToListingsGap,
        programmeLineHeight: columnFit.programmeLineHeight,
        entryGap: columnFit.entryGap
      });
      fits = fits && requiredHeight <= innerHeight;
    }

    return {
      x: columnX,
      yTop: innerY + innerHeight,
      width: columnWidth,
      heading: columnFit.heading,
      headingLines: columnFit.headingLines,
      channelFontSize: columnFit.channelFontSize,
      programmeFontSize: columnFit.programmeFontSize,
      programmeLineHeight: columnFit.programmeLineHeight,
      headingLineHeight: columnFit.headingLineHeight,
      headingToListingsGap: columnFit.headingToListingsGap,
      entryGap: columnFit.entryGap,
      entries: visibleEntries
    };
  });
  const programmeFontSize = Math.min(...columns.map((column) => column.programmeFontSize));
  const channelFontSize = Math.min(...columns.map((column) => column.channelFontSize));
  const programmeLineHeight = Math.min(...columns.map((column) => column.programmeLineHeight));
  const headingLineHeight = Math.min(...columns.map((column) => column.headingLineHeight));
  const headingToListingsGap = Math.min(...columns.map((column) => column.headingToListingsGap));
  const entryGap = Math.min(...columns.map((column) => column.entryGap));

  return {
    channelFontSize,
    programmeFontSize,
    programmeLineHeight,
    headingLineHeight,
    headingToListingsGap,
    entryGap,
    columns,
    fits,
    truncatedCount
  };
}

function normalizeTvChannels(tvListings) {
  const channels = Array.isArray(tvListings?.channels) ? tvListings.channels.slice(0, TV_CHANNEL_COUNT) : [];

  while (channels.length < TV_CHANNEL_COUNT) {
    channels.push({
      name: `Channel ${channels.length + 1}`,
      programs: []
    });
  }

  return channels;
}

function pdfChannelHeading(value) {
  const heading = cleanPdfText(value);

  if (/^BBC One South$/i.test(heading)) {
    return 'BBC One';
  }

  if (/^BBC Two$/i.test(heading)) {
    return 'BBC Two';
  }

  if (/^5$/i.test(heading)) {
    return 'Channel 5';
  }

  return heading;
}

function programmeText(program) {
  const prefix = program?.startTime ? `${formatTvDisplayTime(program.startTime) || program.startTime} ` : '';
  return `${prefix}${program?.title || 'Untitled'}`;
}

function programmeTitle(program) {
  return cleanPdfText(program?.title || 'Untitled');
}

function programmeTime(program) {
  return cleanPdfText(formatTvDisplayTime(program?.startTime) || program?.startTime || '');
}

function programmeTimeFontSize(programmeFontSize) {
  return roundFontSize(programmeFontSize * PROGRAMME_TIME_FONT_SCALE);
}

function programmeTitleXOffset(time, programmeFontSize) {
  return estimateHelveticaWidth(time, programmeTimeFontSize(programmeFontSize)) + PROGRAMME_TIME_TITLE_GAP;
}

function fitBestTvColumn(programs, metrics) {
  const fontOptions = metrics.forceCrowded
    ? [MIN_PROGRAMME_FONT]
    : buildDescendingFontOptions(MAX_PROGRAMME_FONT, MIN_PROGRAMME_FONT, PROGRAMME_FONT_STEP);
  let bestTruncatedFit = null;
  let bestOverflowFit = null;

  for (const programmeFontSize of fontOptions) {
    const channelFontSize = Math.min(programmeFontSize + 0.6, MAX_CHANNEL_FONT);
    const heading = metrics.heading;
    const headingLines = [truncatePdfText(heading, metrics.columnWidth * 0.9, channelFontSize)];
    const fit = fitTvEntriesForColumn(programs, {
      ...metrics,
      channelFontSize,
      entryGap: Math.max(2.2, programmeFontSize * 0.32),
      heading,
      headingLineHeight: channelFontSize * 1.12,
      headingLines,
      headingToListingsGap: Math.max(5, programmeFontSize * 0.48),
      programmeFontSize,
      programmeLineHeight: programmeFontSize * 1.14
    });

    if (fit.fits && fit.truncatedCount === 0 && fit.stackedTitleCount === 0) {
      return fit;
    }

    if (
      fit.fits &&
      (!bestTruncatedFit ||
        fit.truncatedCount < bestTruncatedFit.truncatedCount ||
        (fit.truncatedCount === bestTruncatedFit.truncatedCount &&
          (fit.stackedTitleCount < bestTruncatedFit.stackedTitleCount ||
            (fit.stackedTitleCount === bestTruncatedFit.stackedTitleCount &&
              fit.programmeFontSize > bestTruncatedFit.programmeFontSize))))
    ) {
      bestTruncatedFit = fit;
    }

    if (
      !bestOverflowFit ||
      fit.truncatedCount < bestOverflowFit.truncatedCount ||
      (fit.truncatedCount === bestOverflowFit.truncatedCount &&
        (fit.stackedTitleCount < bestOverflowFit.stackedTitleCount ||
          (fit.stackedTitleCount === bestOverflowFit.stackedTitleCount &&
            fit.requiredHeight < bestOverflowFit.requiredHeight)))
    ) {
      bestOverflowFit = fit;
    }
  }

  return bestTruncatedFit || bestOverflowFit;
}

function fitTvEntriesForColumn(programs, metrics) {
  const lineOptions = metrics.forceCrowded ? [1] : [3, 2, 1];
  let best = null;

  for (const maxLines of lineOptions) {
    const entries = programs.map((program) => {
      const originalText = programmeText(program);
      const time = programmeTime(program);
      const timeFontSize = programmeTimeFontSize(metrics.programmeFontSize);
      const titleXOffset = time ? programmeTitleXOffset(time, metrics.programmeFontSize) : 0;
      const titleWidth = Math.max(20, metrics.columnWidth - titleXOffset);
      const wrapped = wrapProgrammeTitleForEntry(programmeTitle(program), {
        allowTruncate: cleanPdfText(originalText).length > PROGRAMME_TRUNCATE_AFTER_CHARS,
        columnWidth: metrics.columnWidth,
        maxLines,
        programmeFontSize: metrics.programmeFontSize,
        titleWidth,
        titleXOffset,
        time
      });

      return {
        lines: wrapped.lines,
        lineXOffsets: wrapped.lineXOffsets,
        originalText,
        stackedTitle: wrapped.stackedTitle,
        time,
        timeFontSize,
        titleXOffset,
        truncated: wrapped.truncated
      };
    });
    const requiredHeight = columnRequiredHeight({
      entries,
      headingLineHeight: metrics.headingLineHeight,
      headingLines: metrics.headingLines,
      headingToListingsGap: metrics.headingToListingsGap,
      programmeLineHeight: metrics.programmeLineHeight,
      entryGap: metrics.entryGap
    });
    const truncatedCount = countTruncatedEntries(entries);
    const stackedTitleCount = countStackedTitleEntries(entries);
    const fit = {
      channelFontSize: metrics.channelFontSize,
      entries,
      entryGap: metrics.entryGap,
      fits: requiredHeight <= metrics.innerHeight,
      heading: metrics.heading,
      headingLineHeight: metrics.headingLineHeight,
      headingLines: metrics.headingLines,
      headingToListingsGap: metrics.headingToListingsGap,
      programmeFontSize: metrics.programmeFontSize,
      programmeLineHeight: metrics.programmeLineHeight,
      requiredHeight,
      stackedTitleCount,
      truncatedCount
    };

    if (fit.fits && fit.stackedTitleCount === 0) {
      return fit;
    }

    if (
      !best ||
      fit.truncatedCount < best.truncatedCount ||
      (fit.truncatedCount === best.truncatedCount &&
        (fit.stackedTitleCount < best.stackedTitleCount ||
          (fit.stackedTitleCount === best.stackedTitleCount && fit.requiredHeight < best.requiredHeight)))
    ) {
      best = fit;
    }
  }

  return best;
}

function wrapProgrammeTitleForEntry(title, options) {
  const allowTruncate = options.allowTruncate;
  const firstWord = tokenizePdfText(title)[0] || '';
  const firstWordWidth = estimateHelveticaWidth(firstWord, options.programmeFontSize);

  if (
    options.time &&
    options.maxLines > 1 &&
    firstWordWidth > options.titleWidth &&
    firstWordWidth <= options.columnWidth
  ) {
    const wrapped = wrapPdfText(title, options.columnWidth, options.programmeFontSize, options.maxLines - 1, {
      allowTruncate
    });

    return {
      lines: ['', ...wrapped.lines],
      lineXOffsets: [0, ...wrapped.lines.map(() => 0)],
      stackedTitle: true,
      truncated: wrapped.truncated
    };
  }

  const wrapped = wrapPdfText(title, options.titleWidth, options.programmeFontSize, options.maxLines, {
    allowTruncate
  });

  return {
    lines: wrapped.lines,
    lineXOffsets: wrapped.lines.map(() => options.titleXOffset),
    stackedTitle: false,
    truncated: wrapped.truncated
  };
}

function countTruncatedEntries(entries) {
  return entries.filter((entry) => entry.truncated).length;
}

function countStackedTitleEntries(entries) {
  return entries.filter((entry) => entry.stackedTitle).length;
}

function buildDescendingFontOptions(max, min, step) {
  const values = [];

  for (let value = max; value >= min - 0.001; value -= step) {
    values.push(roundFontSize(value));
  }

  return values;
}

function columnRequiredHeight(layout) {
  const entriesHeight = layout.entries.reduce(
    (total, entry, index) =>
      total +
      entry.lines.length * layout.programmeLineHeight +
      (index === layout.entries.length - 1 ? 0 : layout.entryGap),
    0
  );

  return (
    layout.headingLines.length * layout.headingLineHeight +
    layout.headingToListingsGap +
    entriesHeight
  );
}

function entriesThatFit(entries, metrics) {
  const visibleEntries = [];
  let usedHeight =
    metrics.headingLines.length * metrics.headingLineHeight + metrics.headingToListingsGap;

  for (const entry of entries) {
    const additionalGap = visibleEntries.length > 0 ? metrics.entryGap : 0;
    const entryHeight = entry.lines.length * metrics.programmeLineHeight;

    if (usedHeight + additionalGap + entryHeight <= metrics.innerHeight) {
      visibleEntries.push(entry);
      usedHeight += additionalGap + entryHeight;
      continue;
    }

    const remainingHeight = metrics.innerHeight - usedHeight - additionalGap;

    if (remainingHeight >= metrics.programmeLineHeight) {
      visibleEntries.push({
        lines: [truncatePdfText('...', metrics.columnWidth, metrics.programmeFontSize)],
        originalText: entry.originalText,
        truncated: true
      });
    }

    break;
  }

  return visibleEntries;
}

function withoutFitFlag(layout) {
  const { fits, truncatedCount, ...publicLayout } = layout;
  return publicLayout;
}

function roundFontSize(value) {
  return Math.round(value * 100) / 100;
}

function drawGrid(operations, gridX, gridY, gridSize, cellSize) {
  for (let index = 0; index <= 9; index += 1) {
    if (index % 3 === 0) {
      continue;
    }

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

function drawGivens(operations, givens, gridX, gridY, cellSize, numberSize) {
  givens.forEach((value, index) => {
    if (!value) {
      return;
    }

    const row = Math.floor(index / 9);
    const column = index % 9;
    const centerX = gridX + column * cellSize + cellSize / 2;
    const centerY = gridY + (8 - row) * cellSize + cellSize / 2;
    const baselineY = centerY - numberSize * 0.34;

    drawText(operations, value, centerX, baselineY, numberSize, 'F1', 'center');
  });
}

function drawWeatherIcon(operations, icon, x, y, size) {
  if (icon === 'sun') {
    drawSunIcon(operations, x, y, size);
    return;
  }

  if (icon === 'rain' || icon === 'storm' || icon === 'snow') {
    drawCloudIcon(operations, x, y + 2, size);
    drawRainLines(operations, x, y - 9, size);
    return;
  }

  if (icon === 'fog') {
    drawCloudIcon(operations, x, y + 2, size);
    drawLine(operations, x - size, y - 8, x + size, y - 8, 0.8);
    drawLine(operations, x - size * 0.7, y - 12, x + size * 0.7, y - 12, 0.8);
    return;
  }

  drawCloudIcon(operations, x, y + 2, size);
}

function drawSunIcon(operations, x, y, size) {
  drawCircle(operations, x, y, size * 0.52, 1.0);

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const inner = size * 0.78;
    const outer = size * 1.1;
    drawLine(
      operations,
      x + Math.cos(angle) * inner,
      y + Math.sin(angle) * inner,
      x + Math.cos(angle) * outer,
      y + Math.sin(angle) * outer,
      0.9
    );
  }
}

function drawCloudIcon(operations, x, y, size) {
  drawCircle(operations, x - size * 0.45, y - size * 0.1, size * 0.38, 0.9);
  drawCircle(operations, x, y + size * 0.18, size * 0.48, 0.9);
  drawCircle(operations, x + size * 0.48, y - size * 0.05, size * 0.36, 0.9);
  drawLine(operations, x - size * 0.85, y - size * 0.48, x + size * 0.86, y - size * 0.48, 0.9);
}

function drawRainLines(operations, x, y, size) {
  [-0.45, 0, 0.45].forEach((offset) => {
    drawLine(operations, x + size * offset, y + 3, x + size * offset - 1.8, y - 3, 0.9);
  });
}

function drawCircle(operations, x, y, radius, width) {
  const c = radius * 0.5522847498;
  operations.push(`${formatNumber(width)} w ${formatNumber(x + radius)} ${formatNumber(y)} m ${formatNumber(x + radius)} ${formatNumber(y + c)} ${formatNumber(x + c)} ${formatNumber(y + radius)} ${formatNumber(x)} ${formatNumber(y + radius)} c ${formatNumber(x - c)} ${formatNumber(y + radius)} ${formatNumber(x - radius)} ${formatNumber(y + c)} ${formatNumber(x - radius)} ${formatNumber(y)} c ${formatNumber(x - radius)} ${formatNumber(y - c)} ${formatNumber(x - c)} ${formatNumber(y - radius)} ${formatNumber(x)} ${formatNumber(y - radius)} c ${formatNumber(x + c)} ${formatNumber(y - radius)} ${formatNumber(x + radius)} ${formatNumber(y - c)} ${formatNumber(x + radius)} ${formatNumber(y)} c S`);
}

function drawRect(operations, x, y, width, height, lineWidth = 0.6) {
  operations.push(`${formatNumber(lineWidth)} w ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re S`);
}

function drawFilledRect(operations, x, y, width, height, gray = GREY.veryLightFill) {
  operations.push(`${formatNumber(gray)} g ${formatNumber(x)} ${formatNumber(y)} ${formatNumber(width)} ${formatNumber(height)} re f 0 g`);
}

function drawLine(operations, x1, y1, x2, y2, width) {
  operations.push(`${formatNumber(width)} w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`);
}

function drawDottedLine(operations, x1, y1, x2, y2, width, dash = 3) {
  operations.push(`[${formatNumber(dash)} ${formatNumber(dash)}] 0 d`);
  drawLine(operations, x1, y1, x2, y2, width);
  operations.push('[] 0 d');
}

function withClippedBox(operations, box, drawFn, options = {}) {
  operations.push('q');
  operations.push(`${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.width)} ${formatNumber(box.height)} re W n`);
  drawFn();
  operations.push('Q');

  if (options.debugBoxes || safeEnv('PDF_DEBUG_BOXES') === '1') {
    drawRect(operations, box.x, box.y, box.width, box.height, 0.35);
  }
}

function drawText(operations, text, x, y, size, fontName, align = 'left') {
  const cleanText = cleanPdfText(text);
  const estimatedWidth = measureText(cleanText, fontName, size);
  let textX = x;

  if (align === 'center') {
    textX -= estimatedWidth / 2;
  } else if (align === 'right') {
    textX -= estimatedWidth;
  }

  operations.push(`BT /${fontName} ${formatNumber(size)} Tf 1 0 0 1 ${formatNumber(textX)} ${formatNumber(y)} Tm (${escapePdfString(cleanText)}) Tj ET`);
}

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
    usedLines: Math.min(wrapped.lines.length, lineCount),
    finalFontSize: finalSize
  };

  if (meta.truncated) {
    recordOverflow(options, overflowKey, meta);
  }

  return meta;
}

function textBoxAlignedX(text, x, width, font, size, align) {
  if (align === 'center') {
    return x + (width - measureText(text, font, size)) / 2;
  }

  if (align === 'right') {
    return x + width - measureText(text, font, size);
  }

  return x;
}

function recordOverflow(options, key, meta) {
  if (Array.isArray(options.overflowLog)) {
    options.overflowLog.push({ key, ...meta });
  }
}

function safeEnv(name) {
  return typeof process === 'undefined' ? '' : process.env?.[name] || '';
}

function buildPdfDocument(content) {
  const contentLength = encodeAscii(content).byteLength;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(A4_WIDTH)} ${formatNumber(A4_HEIGHT)}] /Resources << /ProcSet [/PDF /Text] /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>',
    `<< /Length ${contentLength} >>\nstream\n${content}endstream`
  ];
  const offsets = [0];
  let pdf = '%PDF-1.4\n';

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

function extractGivens(puzzleData) {
  if (puzzleData && typeof puzzleData === 'object' && !Array.isArray(puzzleData)) {
    const directKey = ['puzzle', 'grid', 'board', 'cells', 'clues', 'givens'].find((key) => key in puzzleData);

    if (directKey) {
      const directValues = normalizeCells(puzzleData[directKey], directKey === 'cells');

      if (!isBooleanMask(directValues)) {
        return directValues;
      }

      const sourceKey = ['puzzle', 'grid', 'board', 'cells', 'values', 'solution'].find((key) => key in puzzleData && key !== directKey);

      if (sourceKey) {
        const sourceValues = normalizeCells(puzzleData[sourceKey], sourceKey === 'cells');
        return directValues.map((isGiven, index) => (isGiven ? sourceValues[index] : ''));
      }
    }
  }

  return normalizeCells(puzzleData);
}

function normalizeCells(input, cellsMayHaveGivenFlag = false) {
  const flattened = flattenGrid(input);

  if (flattened.length !== 81) {
    throw new TypeError('Sudoku puzzle data must contain exactly 81 cells.');
  }

  return flattened.map((cell) => normalizeCellValue(cell, cellsMayHaveGivenFlag));
}

function flattenGrid(input) {
  if (typeof input === 'string') {
    return input.replace(/\s/g, '').split('');
  }

  if (!input || typeof input !== 'object') {
    throw new TypeError('Sudoku puzzle data must be an 81-cell string, array, or grid.');
  }

  if (!Array.isArray(input) && typeof input.length === 'number') {
    return Array.from(input);
  }

  if (!Array.isArray(input)) {
    throw new TypeError('Sudoku puzzle data must be an 81-cell string, array, or grid.');
  }

  if (input.length === 9 && input.every((row) => Array.isArray(row) || typeof row === 'string')) {
    return input.flatMap((row) => (typeof row === 'string' ? row.replace(/\s/g, '').split('') : row));
  }

  return input.slice();
}

function normalizeCellValue(cell, cellsMayHaveGivenFlag = false) {
  if (cell === true || cell === false) {
    return cell;
  }

  if (cell && typeof cell === 'object') {
    if (cellsMayHaveGivenFlag && hasFalseGivenFlag(cell)) {
      return '';
    }

    const value = cell.value ?? cell.digit ?? cell.number ?? cell.given ?? cell.clue ?? '';
    return normalizeCellValue(value);
  }

  if (cell === null || cell === undefined) {
    return '';
  }

  const text = String(cell).trim();

  if (!text || text === '.' || text === '-' || text === '_' || text === '0') {
    return '';
  }

  if (/^[1-9]$/.test(text)) {
    return text;
  }

  throw new TypeError(`Invalid Sudoku cell value: ${text}`);
}

function hasFalseGivenFlag(cell) {
  return cell.given === false || cell.isGiven === false || cell.fixed === false || cell.clue === false;
}

function isBooleanMask(values) {
  return values.length === 81 && values.every((value) => value === true || value === false);
}

function displayDateLabel(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return formatDateLabel(value);
  }

  if (typeof value === 'string') {
    const match = value.match(DATE_KEY_PATTERN);

    if (match) {
      return formatDateLabel(dateFromParts(match[1], match[2], match[3]));
    }

    const trimmed = value.trim();
    return trimmed || formatDateLabel(new Date());
  }

  return formatDateLabel(new Date());
}

function dateKeyFrom(value) {
  if (typeof value === 'string') {
    const match = value.match(DATE_KEY_PATTERN);

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const date = value instanceof Date && !Number.isNaN(value.valueOf()) ? value : new Date();
  return date.toISOString().slice(0, 10);
}

function dateFromParts(year, month, day) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric'
  }).format(date);
}

function shortPdfDayLabel(dateIso) {
  if (typeof dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return '';
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short'
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function weekdayPdfLabel(dateIso) {
  if (typeof dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return '';
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long'
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function shortWeatherRowDayLabel(dateIso) {
  if (typeof dateIso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return 'Later';
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short'
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function shortTemperature(day) {
  const high = day?.highC == null ? '--' : Math.round(day.highC);
  const low = day?.lowC == null ? '--' : Math.round(day.lowC);
  return `${high}/${low} C`;
}

function temperatureValue(value) {
  return value == null ? '-- C' : `${Math.round(value)} C`;
}

function temperatureNumber(value) {
  return value == null ? '--' : String(Math.round(value));
}

function weatherGardenSummary(day) {
  const summary = day?.gardenSummary || {};

  return {
    rainSummary: summary.rainSummary || fallbackRainSummary(day),
    windSummary: summary.windSummary || fallbackWindSummary(day),
    sunSummary: summary.sunSummary || fallbackSunSummary(day),
    wateringSummary: summary.wateringSummary || fallbackWateringSummary(day),
    bestGardenTime: summary.bestGardenTime || ''
  };
}

function weatherDaylightSummary(day) {
  const sunrise = cleanClockTime(day?.sunrise);
  const sunset = cleanClockTime(day?.sunset);

  if (!sunrise && !sunset) {
    return '';
  }

  if (sunrise && sunset) {
    const duration = daylightDurationLabel(sunrise, sunset);
    return duration ? `${sunrise}-${sunset} (${duration})` : `${sunrise}-${sunset}`;
  }

  return sunrise ? `from ${sunrise}` : `until ${sunset}`;
}

function daylightDurationLabel(sunrise, sunset) {
  const sunriseMinutes = clockTimeToMinutes(sunrise);
  const sunsetMinutes = clockTimeToMinutes(sunset);

  if (sunriseMinutes == null || sunsetMinutes == null) {
    return '';
  }

  let durationMinutes = sunsetMinutes - sunriseMinutes;

  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function clockTimeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function cleanClockTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}` : '';
}

function weatherBottomGardenNote(day) {
  const summary = weatherGardenSummary(day);
  return summary.bestGardenTime || summary.wateringSummary || summary.sunSummary || '';
}

function fallbackRainSummary(day) {
  const rain = stripPdfPrefix(day?.rainyPeriodsLabel);

  if (/none expected/i.test(rain)) {
    return 'Mostly dry';
  }

  return `Rain likely ${rain}`;
}

function fallbackWindSummary(day) {
  if (day?.windGustMph != null) {
    return windLabel(day.windGustMph);
  }

  return 'Light wind';
}

function fallbackSunSummary(day) {
  if (day?.sunshineHours != null) {
    return `About ${Math.round(day.sunshineHours)} hours of sun`;
  }

  const sunny = stripPdfPrefix(day?.sunnyPeriodsLabel);
  return /none expected/i.test(sunny) ? 'Limited sunshine' : `Sunny ${sunny}`;
}

function fallbackWateringSummary(day) {
  const rain = stripPdfPrefix(day?.rainyPeriodsLabel);

  if (!/none expected/i.test(rain)) {
    return 'Probably no need to water';
  }

  if (day?.highC != null && day.highC >= 24) {
    return 'Check pots this evening';
  }

  return 'Water pots if soil is dry';
}

function windLabel(maxGustMph) {
  if (maxGustMph >= 35) {
    return 'Very windy - secure pots';
  }

  if (maxGustMph >= 25) {
    return 'Windy';
  }

  if (maxGustMph >= 16) {
    return 'Breezy';
  }

  return 'Light wind';
}

function stripPdfPrefix(value) {
  return String(value || '').replace(/^[^:]+:\s*/, '') || 'none expected';
}

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

function escapePdfString(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimateHelveticaWidth(text, size) {
  return measureText(cleanPdfText(text), 'F1', size);
}

function truncatePdfText(value, maxWidth, size, fontName = 'F1') {
  return truncateToWidth(cleanPdfText(value), fontName, size, maxWidth).text;
}

function tokenizePdfText(text) {
  return cleanPdfText(text)
    .replace(/([/-])/g, '$1 ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);
}

function breakPdfWord(word, maxWidth, size) {
  const cleanWord = cleanPdfText(word);

  if (!cleanWord || measureText(cleanWord, 'F1', size) <= maxWidth) {
    return [cleanWord];
  }

  const parts = [];
  let remaining = cleanWord;

  while (remaining) {
    let take = remaining.length;

    while (take > 1) {
      const candidate = remaining.slice(0, take);
      const rendered = take < remaining.length ? `${candidate}-` : candidate;

      if (measureText(rendered, 'F1', size) <= maxWidth) {
        break;
      }

      take -= 1;
    }

    const piece = remaining.slice(0, take);
    remaining = remaining.slice(take);
    parts.push(remaining ? `${piece}-` : piece);
  }

  return parts;
}

function wrapPdfText(value, maxWidth, size, maxLines, options = {}) {
  const text = cleanPdfText(value);
  const allowTruncate = options.allowTruncate !== false;
  const fontName = options.fontName || 'F1';
  const lineLimit = allowTruncate ? maxLines : Number.POSITIVE_INFINITY;

  if (!text) {
    return { lines: [''], truncated: false };
  }

  if (maxLines <= 1 && allowTruncate) {
    const line = truncatePdfText(text, maxWidth, size, fontName);
    return { lines: [line], truncated: line !== text };
  }

  const words = tokenizePdfText(text);
  const lines = [];
  let index = 0;
  let truncated = false;

  while (index < words.length && lines.length < lineLimit) {
    let line = '';

    while (index < words.length) {
      const candidate = line ? `${line} ${words[index]}` : words[index];

      if (measureText(candidate, fontName, size) <= maxWidth) {
        line = candidate;
        index += 1;
        continue;
      }

      break;
    }

    if (!line) {
      const word = words[index];
      const brokenWord = breakPdfWord(word, maxWidth, size);

      if (brokenWord.length > 1) {
        words.splice(index, 1, ...brokenWord);
        continue;
      }

      line = brokenWord[0] || word;
      index += 1;
    }

    if (allowTruncate && lines.length === lineLimit - 1 && index < words.length) {
      const combined = `${line} ${words.slice(index).join(' ')}`;
      const finalLine = truncatePdfText(combined, maxWidth, size, fontName);
      lines.push(finalLine);
      truncated = true;
      index = words.length;
      break;
    }

    lines.push(line);

    if (allowTruncate && lines.length >= lineLimit) {
      break;
    }
  }

  if (index < words.length) {
    truncated = allowTruncate;
  }

  return { lines, truncated };
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function encodeAscii(value) {
  return new TextEncoder().encode(value);
}

```

## Full Font Metrics And Text Measurement Code

Source: `src/font-metrics.js`

```js
const BASE_WIDTHS = {
  Helvetica: {
    ' ': 278,
    '!': 278,
    '"': 355,
    '#': 556,
    $: 556,
    '%': 889,
    '&': 667,
    "'": 191,
    '(': 333,
    ')': 333,
    '*': 389,
    '+': 584,
    ',': 278,
    '-': 333,
    '.': 278,
    '/': 278,
    ':': 278,
    ';': 278,
    '<': 584,
    '=': 584,
    '>': 584,
    '?': 556,
    '@': 1015,
    '[': 278,
    '\\': 278,
    ']': 278,
    '^': 469,
    _: 556,
    '`': 333,
    '{': 334,
    '|': 260,
    '}': 334,
    '~': 584
  },
  'Helvetica-Bold': {
    ' ': 278,
    '!': 333,
    '"': 474,
    '#': 556,
    $: 556,
    '%': 889,
    '&': 722,
    "'": 238,
    '(': 333,
    ')': 333,
    '*': 389,
    '+': 584,
    ',': 278,
    '-': 333,
    '.': 278,
    '/': 278,
    ':': 333,
    ';': 333,
    '<': 584,
    '=': 584,
    '>': 584,
    '?': 611,
    '@': 975,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 584,
    _: 556,
    '`': 333,
    '{': 389,
    '|': 280,
    '}': 389,
    '~': 584
  },
  'Times-Roman': {
    ' ': 250,
    '!': 333,
    '"': 408,
    '#': 500,
    $: 500,
    '%': 833,
    '&': 778,
    "'": 180,
    '(': 333,
    ')': 333,
    '*': 500,
    '+': 564,
    ',': 250,
    '-': 333,
    '.': 250,
    '/': 278,
    ':': 278,
    ';': 278,
    '<': 564,
    '=': 564,
    '>': 564,
    '?': 444,
    '@': 921,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 469,
    _: 500,
    '`': 333,
    '{': 480,
    '|': 200,
    '}': 480,
    '~': 541
  },
  'Times-Bold': {
    ' ': 250,
    '!': 333,
    '"': 555,
    '#': 500,
    $: 500,
    '%': 1000,
    '&': 833,
    "'": 278,
    '(': 333,
    ')': 333,
    '*': 500,
    '+': 570,
    ',': 250,
    '-': 333,
    '.': 250,
    '/': 278,
    ':': 333,
    ';': 333,
    '<': 570,
    '=': 570,
    '>': 570,
    '?': 500,
    '@': 930,
    '[': 333,
    '\\': 278,
    ']': 333,
    '^': 581,
    _: 500,
    '`': 333,
    '{': 394,
    '|': 220,
    '}': 394,
    '~': 520
  }
};

const DIGIT_WIDTHS = {
  Helvetica: 556,
  'Helvetica-Bold': 556,
  'Times-Roman': 500,
  'Times-Bold': 500
};

const UPPER_WIDTHS = {
  Helvetica: {
    A: 667,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 500,
    K: 667,
    L: 556,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611
  },
  'Helvetica-Bold': {
    A: 722,
    B: 722,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 556,
    K: 722,
    L: 611,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611
  },
  'Times-Roman': {
    A: 722,
    B: 667,
    C: 667,
    D: 722,
    E: 611,
    F: 556,
    G: 722,
    H: 722,
    I: 333,
    J: 389,
    K: 722,
    L: 611,
    M: 889,
    N: 722,
    O: 722,
    P: 556,
    Q: 722,
    R: 667,
    S: 556,
    T: 611,
    U: 722,
    V: 722,
    W: 944,
    X: 722,
    Y: 722,
    Z: 611
  },
  'Times-Bold': {
    A: 722,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 778,
    I: 389,
    J: 500,
    K: 778,
    L: 667,
    M: 944,
    N: 722,
    O: 778,
    P: 611,
    Q: 778,
    R: 722,
    S: 556,
    T: 667,
    U: 722,
    V: 722,
    W: 1000,
    X: 722,
    Y: 722,
    Z: 667
  }
};

const LOWER_WIDTHS = {
  Helvetica: {
    a: 556,
    b: 556,
    c: 500,
    d: 556,
    e: 556,
    f: 278,
    g: 556,
    h: 556,
    i: 222,
    j: 222,
    k: 500,
    l: 222,
    m: 833,
    n: 556,
    o: 556,
    p: 556,
    q: 556,
    r: 333,
    s: 500,
    t: 278,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 500
  },
  'Helvetica-Bold': {
    a: 556,
    b: 611,
    c: 556,
    d: 611,
    e: 556,
    f: 333,
    g: 611,
    h: 611,
    i: 278,
    j: 278,
    k: 556,
    l: 278,
    m: 889,
    n: 611,
    o: 611,
    p: 611,
    q: 611,
    r: 389,
    s: 556,
    t: 333,
    u: 611,
    v: 556,
    w: 778,
    x: 556,
    y: 556,
    z: 500
  },
  'Times-Roman': {
    a: 444,
    b: 500,
    c: 444,
    d: 500,
    e: 444,
    f: 333,
    g: 500,
    h: 500,
    i: 278,
    j: 278,
    k: 500,
    l: 278,
    m: 778,
    n: 500,
    o: 500,
    p: 500,
    q: 500,
    r: 333,
    s: 389,
    t: 278,
    u: 500,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 444
  },
  'Times-Bold': {
    a: 500,
    b: 556,
    c: 444,
    d: 556,
    e: 444,
    f: 333,
    g: 500,
    h: 556,
    i: 278,
    j: 333,
    k: 556,
    l: 278,
    m: 833,
    n: 556,
    o: 500,
    p: 556,
    q: 556,
    r: 444,
    s: 389,
    t: 333,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 444
  }
};

const FONT_ALIASES = new Map([
  ['F1', 'Helvetica'],
  ['F2', 'Helvetica-Bold'],
  ['F3', 'Times-Bold'],
  ['F4', 'Times-Roman']
]);

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

  if (lines.length > maxLines) {
    lines.length = maxLines;
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

function resolveFontFamily(fontName) {
  return FONT_ALIASES.get(fontName) || fontName || 'Helvetica';
}

function widthForCharacter(character, family) {
  if (character >= '0' && character <= '9') {
    return DIGIT_WIDTHS[family] || 500;
  }

  if (character >= 'A' && character <= 'Z') {
    return UPPER_WIDTHS[family]?.[character] || 667;
  }

  if (character >= 'a' && character <= 'z') {
    return LOWER_WIDTHS[family]?.[character] || 500;
  }

  return BASE_WIDTHS[family]?.[character] || 500;
}

function tokenizeForWrap(text) {
  return String(text || '')
    .replace(/([/-])/g, '$1 ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitLongWord(word, fontName, size, maxWidth) {
  if (measureText(word, fontName, size) <= maxWidth) {
    return [word];
  }

  const parts = [];
  let current = '';

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (candidate && measureText(candidate, fontName, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
    }

    current = character;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

```
