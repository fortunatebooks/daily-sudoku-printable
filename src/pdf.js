import { weatherPdfLines } from './weather.js';
import { tvListingsPdfLines } from './tv-listings.js';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PDF_MIME_TYPE = 'application/pdf';
const DATE_KEY_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;

export { A4_HEIGHT, A4_WIDTH };

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
  const gridSize = 480;
  const cellSize = gridSize / 9;
  const gridX = (A4_WIDTH - gridSize) / 2;
  const gridY = 270;
  const titleY = A4_HEIGHT - 36;
  const dateY = titleY - 24;
  const numberSize = 32;
  const operations = [];

  operations.push('q');
  operations.push('0 0 0 RG');
  operations.push('0 0 0 rg');

  drawText(operations, options.title || "Jenny's Sudoku", A4_WIDTH / 2, titleY, 28, 'F2', 'center');
  drawText(operations, displayDateLabel(displayDate), A4_WIDTH / 2, dateY, 14, 'F1', 'center');

  drawGrid(operations, gridX, gridY, gridSize, cellSize);
  drawGivens(operations, givens, gridX, gridY, cellSize, numberSize);
  drawInfoBoxes(operations, options, gridX, 38, gridSize, 210);

  operations.push('Q');

  return `${operations.join('\n')}\n`;
}

function drawInfoBoxes(operations, options, x, y, width, height) {
  const weatherLines = weatherPdfLines(options.weather);
  const tvLines = tvListingsPdfLines(options.tvListings);

  if (weatherLines.length === 0 && tvLines.length === 0) {
    return;
  }

  if (weatherLines.length > 0 && tvLines.length > 0) {
    const gap = 8;
    const weatherHeight = 56;
    const tvHeight = height - weatherHeight - gap;
    const weatherY = y + tvHeight + gap;
    drawWeatherBox(operations, options.weather, weatherLines, x, weatherY, width, weatherHeight);
    drawTvListingsBox(operations, options.tvListings, tvLines, x, y, width, tvHeight);
    return;
  }

  if (tvLines.length > 0) {
    drawTvListingsBox(operations, options.tvListings, tvLines, x, y, width, height);
    return;
  }

  drawWeatherBox(operations, options.weather, weatherLines, x, y, width, height);
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

function drawWeatherBox(operations, weather, fallbackLines, x, y, width, height) {
  drawLineBox(operations, x, y, width, height);

  if (!weather || weather.unavailable || !Array.isArray(weather.days) || weather.days.length === 0) {
    drawInfoLines(operations, fallbackLines, x + 10, y + height - 16, width - 20, 8, 5);
    return;
  }

  const days = weather.days.slice(0, 3);
  const gutter = 10;
  const dayWidth = (width - 20 - gutter * (days.length - 1)) / days.length;
  const dayTop = y + height - 13;

  days.forEach((day, index) => {
    const dayX = x + 10 + index * (dayWidth + gutter);
    const iconX = dayX + 10;
    const iconY = dayTop - 20;
    const label = index === 0 ? 'Today' : shortPdfDayLabel(day.dateIso);
    const rain = stripPdfPrefix(day.rainyPeriodsLabel);
    const sun = `${day.sunrise || '--:--'}-${day.sunset || '--:--'}`;

    drawWeatherIcon(operations, day.icon, iconX, iconY, 10);
    drawText(operations, label, dayX + 29, dayTop, 7.0, 'F2', 'left');
    drawText(operations, truncatePdfText(day.label || 'Forecast', dayWidth - 29, 6.4), dayX + 29, dayTop - 8.8, 6.4, 'F1', 'left');
    drawText(operations, `${shortTemperature(day)}   Rain ${rain}`, dayX + 29, dayTop - 17.4, 6.2, 'F1', 'left');
    drawText(operations, `Sun ${sun}   Moon ${day.moonPhase || ''}`, dayX + 29, dayTop - 26, 6.2, 'F1', 'left');
  });
}

function drawTvListingsBox(operations, tvListings, fallbackLines, x, y, width, height) {
  drawLineBox(operations, x, y, width, height);

  if (!tvListings || tvListings.unavailable || !Array.isArray(tvListings.channels)) {
    drawInfoLines(operations, fallbackLines, x + 10, y + height - 16, width - 20, 7.2, 6);
    return;
  }

  drawText(
    operations,
    `Tonight on TV ${tvListings.windowLabel || '19:00-23:00'}`,
    x + 10,
    y + height - 15,
    8.2,
    'F2',
    'left'
  );

  const channels = tvListings.channels.slice(0, 5);
  const gutter = 9;
  const columnWidth = (width - 20 - gutter * (channels.length - 1)) / channels.length;
  const headingY = y + height - 31;

  channels.forEach((channel, index) => {
    const columnX = x + 10 + index * (columnWidth + gutter);
    drawText(operations, channel.name || 'Channel', columnX, headingY, 7.0, 'F2', 'left');

    const programs = Array.isArray(channel.programs) ? channel.programs : [];
    const entries = programs.length > 0 ? programs : [{ startTime: '', title: 'No listings' }];
    entries.slice(0, 8).forEach((program, programIndex) => {
      const prefix = program.startTime ? `${program.startTime} ` : '';
      drawText(
        operations,
        truncatePdfText(`${prefix}${program.title || 'Untitled'}`, columnWidth, 6.0),
        columnX,
        headingY - 9 - programIndex * 7.3,
        6.0,
        'F1',
        'left'
      );
    });
  });
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

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function encodeAscii(value) {
  return new TextEncoder().encode(value);
}
