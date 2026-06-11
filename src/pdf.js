import { weatherPdfLines } from './weather.js';
import { formatTvDisplayTime, tvListingsPdfLines } from './tv-listings.js';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN_X = 34;
const PAGE_MARGIN_TOP = 28;
const PAGE_MARGIN_BOTTOM = 28;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN_X * 2;
const TITLE_Y = A4_HEIGHT - PAGE_MARGIN_TOP - 6;
const DATE_Y = TITLE_Y - 23;
const GRID_SIZE = 410;
const GRID_X = (A4_WIDTH - GRID_SIZE) / 2;
const GRID_Y = 350;
const WEATHER_HEIGHT = 44;
const WEATHER_GAP_FROM_GRID = 12;
const WEATHER_Y = GRID_Y - WEATHER_GAP_FROM_GRID - WEATHER_HEIGHT;
const TV_GAP_FROM_WEATHER = 6;
const TV_Y = PAGE_MARGIN_BOTTOM;
const TV_HEIGHT = WEATHER_Y - TV_GAP_FROM_WEATHER - TV_Y;
const TV_CHANNEL_COUNT = 5;
const TV_INNER_PADDING_X = 10;
const TV_INNER_PADDING_Y = 9;
const TV_COLUMN_GAP = 10;
const MAX_PROGRAMME_FONT = 12.5;
const MIN_PROGRAMME_FONT = 7.2;
const PROGRAMME_FONT_STEP = 0.25;
const MAX_CHANNEL_FONT = 11.8;
const PROGRAMME_TRUNCATE_AFTER_CHARS = 45;
const PROGRAMME_TIME_FONT_SCALE = 0.86;
const PROGRAMME_TIME_TITLE_GAP = 4;
const PDF_MIME_TYPE = 'application/pdf';
const DATE_KEY_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;

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
  const givens = extractGivens(resolved.puzzleData);
  const content = buildPageContent(givens, resolved.displayDate, resolved.options);

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

function buildPageContent(givens, displayDate, options = {}) {
  const cellSize = GRID_SIZE / 9;
  const numberSize = GRID_SIZE / 15;
  const operations = [];

  operations.push('q');
  operations.push('0 0 0 RG');
  operations.push('0 0 0 rg');

  drawText(operations, options.title || "Jenny's Sudoku", A4_WIDTH / 2, TITLE_Y, 28, 'F2', 'center');
  drawText(operations, displayDateLabel(displayDate), A4_WIDTH / 2, DATE_Y, 14, 'F1', 'center');

  drawGrid(operations, GRID_X, GRID_Y, GRID_SIZE, cellSize);
  drawGivens(operations, givens, GRID_X, GRID_Y, cellSize, numberSize);
  drawInfoBoxes(operations, options);

  operations.push('Q');

  return `${operations.join('\n')}\n`;
}

function drawInfoBoxes(operations, options) {
  const weatherLines = weatherPdfLines(options.weather);
  const tvLines = tvListingsPdfLines(options.tvListings);

  if (weatherLines.length === 0 && tvLines.length === 0) {
    return;
  }

  if (weatherLines.length > 0 && tvLines.length > 0) {
    drawWeatherRow(operations, options.weather, weatherLines, {
      x: PAGE_MARGIN_X,
      y: WEATHER_Y,
      width: CONTENT_WIDTH,
      height: WEATHER_HEIGHT
    });
    drawTvListingsBox(operations, options.tvListings, tvLines, {
      x: PAGE_MARGIN_X,
      y: TV_Y,
      width: CONTENT_WIDTH,
      height: TV_HEIGHT
    });
    return;
  }

  if (tvLines.length > 0) {
    drawTvListingsBox(operations, options.tvListings, tvLines, {
      x: PAGE_MARGIN_X,
      y: TV_Y,
      width: CONTENT_WIDTH,
      height: TV_HEIGHT + WEATHER_HEIGHT + TV_GAP_FROM_WEATHER
    });
    return;
  }

  drawWeatherRow(operations, options.weather, weatherLines, {
    x: PAGE_MARGIN_X,
    y: TV_Y + TV_HEIGHT + TV_GAP_FROM_WEATHER,
    width: CONTENT_WIDTH,
    height: WEATHER_HEIGHT
  });
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
    const size = index === 0 ? 7.6 : 5.7;
    drawText(operations, truncatePdfText(line, width, size), x, y - index * lineGap, size, font, 'left');
  });
}

function drawWeatherRow(operations, weather, fallbackLines, box) {
  const { x, y, width, height } = box;
  if (!weather || weather.unavailable || !Array.isArray(weather.days) || weather.days.length === 0) {
    const lines = fallbackLines.filter((line) => !/^Christchurch weather\b/i.test(line));
    drawInfoLines(operations, lines, x, y + height - 10, width, 8, 4);
    return;
  }

  const days = weather.days.slice(0, 3);
  const gutter = 10;
  const dayWidth = (width - gutter * (days.length - 1)) / days.length;
  const dayTop = y + height - 9;

  days.forEach((day, index) => {
    const dayX = x + index * (dayWidth + gutter);
    const iconX = dayX + 15;
    const iconY = dayTop - 16;
    const textX = dayX + 31;
    const textWidth = dayWidth - 31;
    const label = index === 0 ? 'Today' : shortPdfDayLabel(day.dateIso);
    const rain = stripPdfPrefix(day.rainyPeriodsLabel);
    const sun = `${day.sunrise || '--:--'}-${day.sunset || '--:--'}`;

    drawWeatherIcon(operations, day.icon, iconX, iconY, 10);
    drawText(operations, label, textX, dayTop, 7.8, 'F2', 'left');
    drawText(
      operations,
      truncatePdfText(day.label || 'Forecast', textWidth, 7.0),
      textX,
      dayTop - 9.4,
      7.0,
      'F1',
      'left'
    );
    drawText(
      operations,
      truncatePdfText(`${shortTemperature(day)} Rain ${rain}`, textWidth, 6.6),
      textX,
      dayTop - 18.1,
      6.6,
      'F1',
      'left'
    );
    drawText(
      operations,
      truncatePdfText(`Sun ${sun} Moon ${day.moonPhase || ''}`, textWidth, 6.6),
      textX,
      dayTop - 26.8,
      6.6,
      'F1',
      'left'
    );
  });
}

function drawTvListingsBox(operations, tvListings, fallbackLines, box) {
  const { x, y, width, height } = box;
  drawLineBox(operations, x, y, width, height);

  if (!tvListings || tvListings.unavailable || !Array.isArray(tvListings.channels)) {
    const cleanedLines = fallbackLines.filter((line) => !/^Tonight on TV\b/i.test(line));
    const lines = cleanedLines.length > 0 ? cleanedLines : ['TV listings unavailable'];
    drawInfoLines(operations, lines, x + 10, y + height - 18, width - 20, 11, 10);
    return;
  }

  const layout = layoutTvListingsForPdf(tvListings, box);

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

function programmeTitleXOffset(programmeFontSize) {
  return (
    estimateHelveticaWidth('11:00', programmeTimeFontSize(programmeFontSize)) +
    PROGRAMME_TIME_TITLE_GAP
  );
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

    if (fit.fits && fit.truncatedCount === 0) {
      return fit;
    }

    if (
      fit.fits &&
      (!bestTruncatedFit ||
        fit.truncatedCount < bestTruncatedFit.truncatedCount ||
        (fit.truncatedCount === bestTruncatedFit.truncatedCount &&
          fit.programmeFontSize > bestTruncatedFit.programmeFontSize))
    ) {
      bestTruncatedFit = fit;
    }

    if (
      !bestOverflowFit ||
      fit.truncatedCount < bestOverflowFit.truncatedCount ||
      (fit.truncatedCount === bestOverflowFit.truncatedCount && fit.requiredHeight < bestOverflowFit.requiredHeight)
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
      const titleXOffset = time ? programmeTitleXOffset(metrics.programmeFontSize) : 0;
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
      truncatedCount
    };

    if (fit.fits) {
      return fit;
    }

    if (
      !best ||
      fit.truncatedCount < best.truncatedCount ||
      (fit.truncatedCount === best.truncatedCount && fit.requiredHeight < best.requiredHeight)
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
      truncated: wrapped.truncated
    };
  }

  const wrapped = wrapPdfText(title, options.titleWidth, options.programmeFontSize, options.maxLines, {
    allowTruncate
  });

  return {
    lines: wrapped.lines,
    lineXOffsets: wrapped.lines.map(() => options.titleXOffset),
    truncated: wrapped.truncated
  };
}

function countTruncatedEntries(entries) {
  return entries.filter((entry) => entry.truncated).length;
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
    drawLine(operations, gridX + offset, gridY, gridX + offset, gridY + gridSize, 0.8);
    drawLine(operations, gridX, gridY + offset, gridX + gridSize, gridY + offset, 0.8);
  }

  for (let index = 0; index <= 9; index += 3) {
    const offset = index * cellSize;
    drawLine(operations, gridX + offset, gridY, gridX + offset, gridY + gridSize, 2.4);
    drawLine(operations, gridX, gridY + offset, gridX + gridSize, gridY + offset, 2.4);
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

function drawLine(operations, x1, y1, x2, y2, width) {
  operations.push(`${formatNumber(width)} w ${formatNumber(x1)} ${formatNumber(y1)} m ${formatNumber(x2)} ${formatNumber(y2)} l S`);
}

function drawText(operations, text, x, y, size, fontName, align = 'left') {
  const cleanText = cleanPdfText(text);
  const estimatedWidth = estimateHelveticaWidth(cleanText, size);
  let textX = x;

  if (align === 'center') {
    textX -= estimatedWidth / 2;
  } else if (align === 'right') {
    textX -= estimatedWidth;
  }

  operations.push(`BT /${fontName} ${formatNumber(size)} Tf 1 0 0 1 ${formatNumber(textX)} ${formatNumber(y)} Tm (${escapePdfString(cleanText)}) Tj ET`);
}

function buildPdfDocument(content) {
  const contentLength = encodeAscii(content).byteLength;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(A4_WIDTH)} ${formatNumber(A4_HEIGHT)}] /Resources << /ProcSet [/PDF /Text] /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
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

function shortTemperature(day) {
  const high = day?.highC == null ? '--' : Math.round(day.highC);
  const low = day?.lowC == null ? '--' : Math.round(day.lowC);
  return `${high}/${low} C`;
}

function stripPdfPrefix(value) {
  return String(value || '').replace(/^[^:]+:\s*/, '') || 'none expected';
}

function cleanPdfText(text) {
  return String(text).replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, '?').trim();
}

function escapePdfString(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimateHelveticaWidth(text, size) {
  let units = 0;

  for (const character of text) {
    if (character === ' ') {
      units += 0.278;
    } else if (character >= '0' && character <= '9') {
      units += 0.556;
    } else if ('.,:;'.includes(character)) {
      units += 0.278;
    } else if ('ilIjtfr'.includes(character)) {
      units += 0.28;
    } else if ('mwMW'.includes(character)) {
      units += 0.83;
    } else if (character >= 'A' && character <= 'Z') {
      units += 0.67;
    } else {
      units += 0.5;
    }
  }

  return units * size;
}

function truncatePdfText(value, maxWidth, size) {
  let text = cleanPdfText(value);

  while (text.length > 3 && estimateHelveticaWidth(text, size) > maxWidth) {
    text = text.slice(0, -4).trimEnd();
    text = `${text}...`;
  }

  return text;
}

function tokenizePdfText(text) {
  return text
    .replace(/([/-])/g, '$1 ')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);
}

function breakPdfWord(word, maxWidth, size) {
  const cleanWord = cleanPdfText(word);

  if (!cleanWord || estimateHelveticaWidth(cleanWord, size) <= maxWidth) {
    return [cleanWord];
  }

  const parts = [];
  let remaining = cleanWord;

  while (remaining) {
    let take = remaining.length;

    while (take > 1) {
      const candidate = remaining.slice(0, take);
      const rendered = take < remaining.length ? `${candidate}-` : candidate;

      if (estimateHelveticaWidth(rendered, size) <= maxWidth) {
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
  const lineLimit = allowTruncate ? maxLines : Number.POSITIVE_INFINITY;

  if (!text) {
    return { lines: [''], truncated: false };
  }

  if (maxLines <= 1 && allowTruncate) {
    const line = truncatePdfText(text, maxWidth, size);
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

      if (estimateHelveticaWidth(candidate, size) <= maxWidth) {
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
      const finalLine = truncatePdfText(combined, maxWidth, size);
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
