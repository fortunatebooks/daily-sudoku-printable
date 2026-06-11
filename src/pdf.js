const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PDF_MIME_TYPE = 'application/pdf';
const DATE_KEY_PATTERN = /(\d{4})-(\d{2})-(\d{2})/;

export { A4_HEIGHT, A4_WIDTH };

export function sudokuPdfFilename(displayDate = new Date()) {
  return `sudoku-${dateKeyFrom(displayDate)}.pdf`;
}

export function buildSudokuPdf(puzzleData, displayDate = new Date()) {
  const bytes = buildSudokuPdfBytes(puzzleData, displayDate);

  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    return new Blob([bytes], { type: PDF_MIME_TYPE });
  }

  return bytes;
}

export function buildSudokuPdfBytes(puzzleData, displayDate = new Date()) {
  const givens = extractGivens(puzzleData);
  const content = buildPageContent(givens, displayDate);

  return encodeAscii(buildPdfDocument(content));
}

export default buildSudokuPdf;

function buildPageContent(givens, displayDate) {
  const gridSize = 510;
  const cellSize = gridSize / 9;
  const gridX = (A4_WIDTH - gridSize) / 2;
  const gridY = (A4_HEIGHT - gridSize) / 2;
  const titleY = A4_HEIGHT - 62;
  const dateY = titleY - 28;
  const numberSize = 33;
  const operations = [];

  operations.push('q');
  operations.push('0 0 0 RG');
  operations.push('0 0 0 rg');

  drawText(operations, 'Daily Sudoku', A4_WIDTH / 2, titleY, 28, 'F2', 'center');
  drawText(operations, displayDateLabel(displayDate), A4_WIDTH / 2, dateY, 14, 'F1', 'center');

  drawGrid(operations, gridX, gridY, gridSize, cellSize);
  drawGivens(operations, givens, gridX, gridY, cellSize, numberSize);

  operations.push('Q');

  return `${operations.join('\n')}\n`;
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

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function encodeAscii(value) {
  return new TextEncoder().encode(value);
}
