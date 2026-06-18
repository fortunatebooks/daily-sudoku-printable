import { createRequire } from 'node:module';

import PDFDocument from 'pdfkit';

import { sudokuPdfFilename } from './pdf.js';
import { formatTvDisplayTime } from './tv-listings.js';

const require = createRequire(import.meta.url);

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PDF_MIME_TYPE = 'application/pdf';
const DATE_KEY_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;
const TV_CHANNEL_COUNT = 5;
const MIN_MEANINGFUL_FONT = 8.5;
const FONTS = {
  serifBold: 'LoraBold',
  sans: 'SourceSans',
  sansSemi: 'SourceSansSemi',
  sansBold: 'SourceSansBold'
};
const FONT_FILES = {
  [FONTS.serifBold]: require.resolve('@fontsource/lora/files/lora-latin-700-normal.woff'),
  [FONTS.sans]: require.resolve('@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff'),
  [FONTS.sansSemi]: require.resolve('@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff'),
  [FONTS.sansBold]: require.resolve('@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff')
};
const PAGE = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  marginX: 32,
  top: 24,
  bottom: 28
};
const LAYOUT = {
  titleY: 16,
  dateY: 36,
  mastheadRuleY: 64,
  puzzleX: 32,
  puzzleOneGridY: 95,
  puzzleTwoGridY: 343,
  puzzleLabelOffset: 17,
  puzzleGridSize: 228,
  weatherX: 280,
  weatherY: 78,
  weatherWidth: 283,
  tvX: 32,
  tvY: 596,
  tvWidth: 531,
  tvHeight: 218
};
LAYOUT.weatherHeight = LAYOUT.tvY - LAYOUT.weatherY - 18;
const GREY = {
  rail: '#f5f5f5',
  rule: '#555555'
};

export { sudokuPdfFilename };

export async function buildSudokuPdf(puzzleData, displayDate = new Date(), options = {}) {
  const bytes = await buildSudokuPdfBytes(puzzleData, displayDate, options);

  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: PDF_MIME_TYPE });
  }

  return bytes;
}

export async function buildSudokuPdfBytes(puzzleData, displayDate = new Date(), options = {}) {
  const resolved = resolvePdfInputs(puzzleData, displayDate, options);
  const puzzles = resolvePdfPuzzles(resolved.puzzleData, resolved.options);
  const doc = new PDFDocument({
    autoFirstPage: true,
    bufferPages: false,
    compress: false,
    margin: 0,
    size: [A4_WIDTH, A4_HEIGHT]
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  registerFonts(doc);
  drawPage(doc, puzzles, resolved.displayDate, resolved.options);
  doc.end();

  return done;
}

export default buildSudokuPdf;

function registerFonts(doc) {
  Object.entries(FONT_FILES).forEach(([name, file]) => {
    doc.registerFont(name, file);
  });
}

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

function drawPage(doc, puzzles, displayDate, options = {}) {
  if (options.layoutDebug && typeof options.layoutDebug === 'object') {
    options.layoutDebug.page = {
      mastheadRuleY: LAYOUT.mastheadRuleY,
      puzzleGridSize: LAYOUT.puzzleGridSize,
      puzzleOneGridY: LAYOUT.puzzleOneGridY,
      puzzleTwoGridY: LAYOUT.puzzleTwoGridY,
      tvY: LAYOUT.tvY,
      tvHeight: LAYOUT.tvHeight,
      weatherY: LAYOUT.weatherY,
      weatherHeight: LAYOUT.weatherHeight
    };
  }

  drawMasthead(doc, options.title || "Jenny's Sudoku", displayDate);
  drawPuzzlePanel(doc, puzzles[0], {
    gridX: LAYOUT.puzzleX,
    gridY: LAYOUT.puzzleOneGridY
  });

  if (puzzles[1]) {
    drawPuzzlePanel(doc, puzzles[1], {
      gridX: LAYOUT.puzzleX,
      gridY: LAYOUT.puzzleTwoGridY
    });
  }

  drawWeatherPanel(doc, options.weather, {
    x: LAYOUT.weatherX,
    y: LAYOUT.weatherY,
    width: LAYOUT.weatherWidth,
    height: LAYOUT.weatherHeight
  });
  drawTvPanel(doc, options.tvListings, {
    x: LAYOUT.tvX,
    y: LAYOUT.tvY,
    width: LAYOUT.tvWidth,
    height: LAYOUT.tvHeight
  }, options);
}

function drawMasthead(doc, title, displayDate) {
  doc
    .font(FONTS.serifBold)
    .fontSize(31)
    .fillColor('black')
    .text(cleanPdfText(title), PAGE.marginX, LAYOUT.titleY, {
      align: 'center',
      width: PAGE.width - PAGE.marginX * 2
    });
  doc
    .font(FONTS.sansSemi)
    .fontSize(10.8)
    .text(displayDateLabel(displayDate), PAGE.width - PAGE.marginX - 145, LAYOUT.dateY, {
      align: 'right',
      width: 145
    });
  drawLine(doc, PAGE.marginX, LAYOUT.mastheadRuleY, PAGE.width - PAGE.marginX, LAYOUT.mastheadRuleY, 1.05);
  drawLine(doc, PAGE.marginX, LAYOUT.mastheadRuleY + 4, PAGE.width - PAGE.marginX, LAYOUT.mastheadRuleY + 4, 0.35);
}

function drawPuzzlePanel(doc, puzzle, metrics) {
  const labelY = metrics.gridY - LAYOUT.puzzleLabelOffset;
  const label = `PUZZLE ${puzzle.number} - ${cleanPdfText(puzzle.label).toUpperCase()}`;

  doc
    .font(FONTS.sansBold)
    .fontSize(10.2)
    .fillColor('black')
    .text(label, metrics.gridX, labelY, {
      width: LAYOUT.puzzleGridSize,
      height: 14,
      align: 'left'
    });
  drawGrid(doc, metrics.gridX, metrics.gridY, LAYOUT.puzzleGridSize);
  drawGivens(doc, puzzle.givens, metrics.gridX, metrics.gridY, LAYOUT.puzzleGridSize / 9);
}

function drawGrid(doc, x, y, size) {
  const cell = size / 9;

  for (let index = 0; index <= 9; index += 1) {
    const width = index % 3 === 0 ? 2.0 : 0.5;
    const offset = index * cell;
    drawLine(doc, x + offset, y, x + offset, y + size, width);
    drawLine(doc, x, y + offset, x + size, y + offset, width);
  }
}

function drawGivens(doc, givens, gridX, gridY, cellSize) {
  const numberSize = Math.min(17, cellSize * 0.65);

  doc.font(FONTS.sansSemi).fontSize(numberSize).fillColor('black');
  const lineHeight = doc.currentLineHeight();
  const opticalLift = numberSize * 0.12;
  const topOffset = (cellSize - lineHeight) / 2 - opticalLift;

  givens.forEach((value, index) => {
    if (!value) {
      return;
    }

    const row = Math.floor(index / 9);
    const column = index % 9;
    const x = gridX + column * cellSize;
    const y = gridY + row * cellSize + topOffset;

    doc.text(value, x, y, {
      width: cellSize,
      height: lineHeight,
      align: 'center',
      lineBreak: false
    });
  });
}

function drawWeatherPanel(doc, weather, box) {
  const titleY = box.y;
  drawWeatherIcon(doc, 'partly-cloudy', box.x + 5, titleY + 2, 13);
  doc
    .font(FONTS.serifBold)
    .fontSize(13.4)
    .fillColor('black')
    .text('WEATHER FOR THE GARDEN', box.x + 34, titleY - 1, {
      width: box.width - 34,
      height: 20
    });
  drawLine(doc, box.x, box.y + 24, box.x + box.width, box.y + 24, 0.75);

  if (!weather || weather.unavailable || !Array.isArray(weather.days) || weather.days.length === 0) {
    doc
      .font(FONTS.sans)
      .fontSize(10)
      .text('Weather forecast unavailable', box.x + 8, box.y + 38, {
        width: box.width - 16
      });
    return;
  }

  const days = weather.days.slice(0, 4);
  const today = days[0];
  const todayY = box.y + 36;
  const todayH = 126;
  drawTodayWeather(doc, today, {
    x: box.x,
    y: todayY,
    width: box.width,
    height: todayH
  });

  const rowH = 40;
  const rowStartY = todayY + todayH + 8;
  days.slice(1, 4).forEach((day, index) => {
    drawWeatherDayRow(doc, day, {
      x: box.x,
      y: rowStartY + index * rowH,
      width: box.width,
      height: rowH
    });
  });

  const note = weatherBottomGardenNote(today);
  if (note) {
    const noteY = rowStartY + Math.max(1, days.slice(1, 4).length) * rowH + 16;

    if (noteY + 18 > box.y + box.height) {
      return;
    }

    drawLine(doc, box.x, noteY - 7, box.x + box.width, noteY - 7, 0.35);
    doc
      .font(FONTS.sansBold)
      .fontSize(9.5)
      .text(cleanPdfText(note), box.x + 8, noteY, {
        width: box.width - 16,
        height: 18
      });
  }
}

function drawTodayWeather(doc, day, box) {
  const summary = weatherGardenSummary(day);
  const daylight = weatherDaylightSummary(day);

  drawLine(doc, box.x, box.y, box.x + box.width, box.y, 0.45);
  drawLine(doc, box.x, box.y + box.height, box.x + box.width, box.y + box.height, 0.45);
  doc.font(FONTS.sansBold).fontSize(12.2).text('TODAY', box.x + 8, box.y + 8, {
    width: 80
  });
  doc.font(FONTS.sansBold).fontSize(9.7).text(`High ${temperatureNumber(day.highC)} / Low ${temperatureNumber(day.lowC)}`, box.x, box.y + 10, {
    align: 'right',
    width: box.width - 8
  });
  drawWeatherIcon(doc, day.icon, box.x + 24, box.y + 38, 18);
  drawFitText(doc, day.label || 'Forecast', {
    x: box.x + 70,
    y: box.y + 39,
    width: box.width - 84,
    font: FONTS.sans,
    size: 9.8,
    maxLines: 2,
    lineHeight: 11.2
  });
  drawLine(doc, box.x + 8, box.y + 68, box.x + box.width - 8, box.y + 68, 0.35);
  drawWeatherMetric(doc, 'Rain', summary.rainSummary, box.x + 8, box.y + 77, box.width - 16);
  drawWeatherMetric(doc, 'Wind', summary.windSummary, box.x + 8, box.y + 88, box.width - 16);
  drawWeatherMetric(doc, 'Garden', summary.wateringSummary, box.x + 8, box.y + 99, box.width - 16);

  if (daylight) {
    drawWeatherMetric(doc, 'Daylight', daylight, box.x + 8, box.y + 110, box.width - 16);
  }
}

function drawWeatherMetric(doc, label, value, x, y, width) {
  doc.font(FONTS.sansBold).fontSize(9).text(`${label}:`, x, y, {
    width: 58
  });
  drawFitText(doc, value || 'No detail', {
    x: x + 68,
    y,
    width: width - 68,
    font: FONTS.sans,
    size: 9,
    maxLines: 1,
    lineHeight: 10.3
  });
}

function drawWeatherDayRow(doc, day, box) {
  const summary = weatherGardenSummary(day);

  drawLine(doc, box.x, box.y, box.x + box.width, box.y, 0.25, GREY.rule);
  doc.font(FONTS.sansBold).fontSize(9.6).text(shortWeatherRowDayLabel(day.dateIso), box.x + 8, box.y + 10, {
    width: 34
  });
  drawWeatherIcon(doc, day.icon, box.x + 56, box.y + 12, 12);
  doc.font(FONTS.sansBold).fontSize(9.1).text(shortTemperature(day), box.x + 82, box.y + 10, {
    width: 48
  });
  drawFitText(doc, summary.rainSummary, {
    x: box.x + 136,
    y: box.y + 8,
    width: box.width - 144,
    font: FONTS.sans,
    size: 9.1,
    maxLines: 1,
    lineHeight: 10.5
  });
  drawFitText(doc, summary.windSummary, {
    x: box.x + 136,
    y: box.y + 22,
    width: box.width - 144,
    font: FONTS.sans,
    size: 9.1,
    maxLines: 1,
    lineHeight: 10.5
  });
}

function drawTvPanel(doc, tvListings, box, options = {}) {
  doc.rect(box.x, box.y, box.width, box.height).lineWidth(0.55).strokeColor('black').stroke();

  const rows = normalizeTvChannels(tvListings);
  const topPadding = 4;
  const bottomPadding = 4;
  const rowH = (box.height - topPadding - bottomPadding) / TV_CHANNEL_COUNT;
  const labelW = 68;
  const rowDebug = [];

  rows.forEach((channel, index) => {
    const rowY = box.y + topPadding + index * rowH;
    const heading = pdfChannelHeading(channel.name || `Channel ${index + 1}`);
    const programmes = Array.isArray(channel.programs) && channel.programs.length > 0
      ? channel.programs
      : [{ startTime: '', title: 'No listings' }];
    const listingX = box.x + labelW + 12;
    const listingWidth = box.width - labelW - 20;
    const layout = layoutTvProgramLines(doc, programmes, {
      width: listingWidth,
      maxLines: 4
    });

    doc.save();
    doc.rect(box.x + 0.55, rowY + 0.2, labelW, rowH - 0.4).fill(GREY.rail);
    doc.restore();
    drawLine(doc, box.x + labelW, rowY, box.x + labelW, rowY + rowH, 0.25, GREY.rule);
    drawLine(doc, box.x + 8, rowY + rowH, box.x + box.width - 8, rowY + rowH, 0.35, GREY.rule);
    doc
      .font(FONTS.sansBold)
      .fontSize(10.2)
      .fillColor('black')
      .text(heading.toUpperCase(), box.x + 8, rowY + Math.max(9, (rowH - 12) / 2), {
        width: labelW - 13,
        height: rowH - 4
      });

    const totalTextHeight = layout.lines.length * layout.lineHeight;
    const startY = rowY + Math.max(6, (rowH - totalTextHeight) / 2);
    layout.lines.forEach((line, lineIndex) => {
      let cursorX = listingX;
      const cursorY = startY + lineIndex * layout.lineHeight;
      line.forEach((chunk) => {
        doc.font(FONTS.sansBold).fontSize(chunk.timeSize).text(chunk.time, cursorX, cursorY, {
          lineBreak: false
        });
        cursorX += chunk.timeWidth;

        if (chunk.title) {
          cursorX += chunk.spaceWidth;
          doc.font(FONTS.sans).fontSize(chunk.titleSize).text(chunk.title, cursorX, cursorY, {
            lineBreak: false
          });
          cursorX += chunk.titleWidth;
        }

        cursorX += chunk.gap;
      });
    });
    rowDebug.push({
      heading,
      programmes: layout.programmes,
      lineCount: layout.lines.length,
      minFontSize: Math.min(layout.titleSize, layout.timeSize),
      rowHeight: rowH
    });
  });

  if (options.layoutDebug && Array.isArray(options.layoutDebug.tvRows)) {
    options.layoutDebug.tvRows.push(...rowDebug);
  }
}

function layoutTvProgramLines(doc, programmes, metrics) {
  const candidates = [
    { titleSize: 9.5, timeSize: 9.2, lineHeight: 12.2 },
    { titleSize: 9.2, timeSize: 9.0, lineHeight: 11.6 },
    { titleSize: 8.8, timeSize: 8.8, lineHeight: 10.8 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 10.2 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 10.0, titleMax: 260 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 10.0, titleMax: 220 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 10.0, titleMax: 180 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 10.0, titleMax: 140 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 9.8, titleMax: 100 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 9.8, titleMax: 70 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 9.8, titleMax: 48 },
    { titleSize: 8.5, timeSize: 8.5, lineHeight: 9.8, titleMax: 28 }
  ];

  for (const candidate of candidates) {
    const layout = tryLayoutTvProgramLines(doc, programmes, metrics, candidate);

    if (layout.fits) {
      return layout;
    }
  }

  return tryLayoutTvProgramLines(doc, programmes, metrics, {
    titleSize: MIN_MEANINGFUL_FONT,
    timeSize: MIN_MEANINGFUL_FONT,
    lineHeight: 9.8,
    titleMax: 18
  }, { force: true });
}

function tryLayoutTvProgramLines(doc, programmes, metrics, style, options = {}) {
  const lines = [[]];
  const placedProgrammes = [];
  const maxLines = metrics.maxLines || 4;

  for (const programme of programmes) {
    const chunk = buildTvChunk(doc, programme, metrics.width, style);
    let line = lines[lines.length - 1];

    if (line.length > 0 && tvLineWidth(line) + chunk.width > metrics.width) {
      if (lines.length >= maxLines && !options.force) {
        return { fits: false };
      }

      line = [];
      lines.push(line);
    }

    line.push(chunk);
    placedProgrammes.push({
      time: chunk.time,
      title: chunk.originalTitle,
      renderedTitle: chunk.title,
      truncated: chunk.truncated
    });
  }

  return {
    fits: options.force || lines.length <= maxLines,
    lines,
    lineHeight: style.lineHeight,
    programmes: placedProgrammes,
    timeSize: style.timeSize,
    titleSize: style.titleSize
  };
}

function buildTvChunk(doc, programme, rowWidth, style) {
  const time = tvProgrammeTimeLabel(programme);
  const originalTitle = cleanPdfText(programme?.title || 'Untitled');
  const timeWidth = textWidth(doc, time, FONTS.sansBold, style.timeSize);
  const spaceWidth = time && originalTitle ? 4 : 0;
  const gap = 10;
  const availableTitleWidth = Math.max(8, rowWidth - timeWidth - spaceWidth - gap);
  const configuredTitleWidth = Number.isFinite(style.titleMax) ? style.titleMax : availableTitleWidth;
  const maxTitleWidth = Math.max(8, Math.min(configuredTitleWidth, availableTitleWidth));
  const fittedTitle = truncateToWidth(doc, originalTitle, FONTS.sans, style.titleSize, maxTitleWidth);
  const titleWidth = textWidth(doc, fittedTitle.text, FONTS.sans, style.titleSize);

  return {
    time,
    title: fittedTitle.text,
    originalTitle,
    truncated: fittedTitle.truncated,
    timeSize: style.timeSize,
    titleSize: style.titleSize,
    timeWidth,
    titleWidth,
    spaceWidth,
    gap,
    width: timeWidth + spaceWidth + titleWidth + gap
  };
}

function tvLineWidth(line) {
  return line.reduce((total, chunk) => total + chunk.width, 0);
}

function drawFitText(doc, text, config) {
  const clean = cleanPdfText(text);
  const maxLines = config.maxLines || 1;
  const lines = wrapText(doc, clean, config.font, config.size, config.width, maxLines);

  doc.font(config.font).fontSize(config.size).fillColor('black');
  lines.forEach((line, index) => {
    doc.text(line, config.x, config.y + index * config.lineHeight, {
      width: config.width,
      height: config.lineHeight,
      lineBreak: false
    });
  });
}

function wrapText(doc, text, font, size, width, maxLines) {
  const words = cleanPdfText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (textWidth(doc, candidate, font, size) <= width) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
      current = word;
      return;
    }

    lines.push(truncateToWidth(doc, word, font, size, width).text);
    current = '';
  });

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncateToWidth(doc, kept[maxLines - 1], font, size, width).text;
    return kept;
  }

  return lines.length > 0 ? lines : [''];
}

function textWidth(doc, text, font, size) {
  doc.font(font).fontSize(size);
  return doc.widthOfString(cleanPdfText(text));
}

function truncateToWidth(doc, text, font, size, maxWidth) {
  const clean = cleanPdfText(text);

  if (textWidth(doc, clean, font, size) <= maxWidth) {
    return { text: clean, truncated: false };
  }

  const ellipsis = '...';
  let result = clean;

  while (result.length > 0 && textWidth(doc, `${result.trimEnd()}${ellipsis}`, font, size) > maxWidth) {
    result = result.slice(0, -1);
  }

  return {
    text: result ? `${result.trimEnd()}${ellipsis}` : ellipsis,
    truncated: true
  };
}

function drawWeatherIcon(doc, icon, x, y, size) {
  const resolvedIcon = icon || 'cloud';

  if (resolvedIcon === 'sun') {
    drawSunIcon(doc, x, y, size);
    return;
  }

  if (resolvedIcon === 'rain' || resolvedIcon === 'storm' || resolvedIcon === 'snow') {
    drawCloudIcon(doc, x, y + 2, size);
    drawRainLines(doc, x, y + size * 0.92, size);
    return;
  }

  if (resolvedIcon === 'fog') {
    drawCloudIcon(doc, x, y + 2, size);
    drawLine(doc, x - size * 0.9, y + size, x + size * 0.9, y + size, 1.25);
    drawLine(doc, x - size * 0.65, y + size * 1.25, x + size * 0.65, y + size * 1.25, 1.25);
    return;
  }

  if (resolvedIcon === 'partly-cloudy') {
    drawCloudIcon(doc, x, y + 2, size);
    return;
  }

  drawCloudIcon(doc, x, y + 2, size);
}

function drawSunIcon(doc, x, y, size) {
  doc.save().lineWidth(1.5).strokeColor('black');
  doc.circle(x, y, size * 0.45).stroke();

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const inner = size * 0.68;
    const outer = size * 1.0;
    doc
      .moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner)
      .lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer)
      .stroke();
  }

  doc.restore();
}

function drawCloudIcon(doc, x, y, size) {
  doc.save().lineWidth(1.5).strokeColor('black');
  doc.circle(x - size * 0.45, y, size * 0.36).stroke();
  doc.circle(x, y - size * 0.2, size * 0.46).stroke();
  doc.circle(x + size * 0.48, y, size * 0.34).stroke();
  doc
    .moveTo(x - size * 0.82, y + size * 0.34)
    .lineTo(x + size * 0.86, y + size * 0.34)
    .stroke();
  doc.restore();
}

function drawRainLines(doc, x, y, size) {
  doc.save().lineWidth(1.5).strokeColor('black');
  [-0.45, 0, 0.45].forEach((offset) => {
    doc
      .moveTo(x + size * offset, y)
      .lineTo(x + size * offset - 2.2, y + 7)
      .stroke();
  });
  doc.restore();
}

function drawLine(doc, x1, y1, x2, y2, width, color = 'black') {
  doc
    .save()
    .lineWidth(width)
    .strokeColor(color)
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke()
    .restore();
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

function tvProgrammeTimeLabel(programme) {
  if (!programme?.startTime) {
    return '';
  }

  return formatTvDisplayTime(programme.startTime) || programme.startTime;
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
