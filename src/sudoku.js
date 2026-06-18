export const LONDON_TIME_ZONE = 'Europe/London';
export const HARD_PUZZLE_START_DATE = '2026-06-18';
export const MEDIUM_DIFFICULTY = 'medium';
export const HARD_DIFFICULTY = 'hard';
export const MEDIUM_TARGET_CLUES = 34;
export const HARD_TARGET_CLUES = 28;
export const DIFFICULTY = MEDIUM_DIFFICULTY;
export const TARGET_CLUES = MEDIUM_TARGET_CLUES;

const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const BOX_SIZE = 3;
const FULL_MASK = 0x1ff;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_PATTERN = /^\/(?:puzzle|print|pdf)\/([^/]+)$/;

const DIGIT_BY_BIT = new Map();
for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
  DIGIT_BY_BIT.set(1 << (digit - 1), digit);
}

function assertValidDateString(dateString) {
  if (typeof dateString !== 'string' || !DATE_PATTERN.test(dateString)) {
    throw new RangeError('Expected date in YYYY-MM-DD format');
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('Expected a real calendar date');
  }
}

export function isValidDateString(dateString) {
  try {
    assertValidDateString(dateString);
    return true;
  } catch {
    return false;
  }
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Expected a valid Date value');
  }
  return date;
}

function formatDateParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatUtcDate(date) {
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seedInput) {
  return mulberry32(fnv1a(seedInput));
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function rowPattern(row, column) {
  return (BOX_SIZE * (row % BOX_SIZE) + Math.floor(row / BOX_SIZE) + column) % GRID_SIZE;
}

function createSolvedGrid(seedInput) {
  const random = seededRandom(seedInput);
  const base = [0, 1, 2];
  const rows = shuffled(base, random).flatMap((band) =>
    shuffled(base, random).map((row) => band * BOX_SIZE + row)
  );
  const columns = shuffled(base, random).flatMap((stack) =>
    shuffled(base, random).map((column) => stack * BOX_SIZE + column)
  );
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

  let solution = '';
  for (const row of rows) {
    for (const column of columns) {
      solution += String(digits[rowPattern(row, column)]);
    }
  }
  return solution;
}

function boxIndex(row, column) {
  return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(column / BOX_SIZE);
}

function parseGrid(grid) {
  if (typeof grid !== 'string' || grid.length !== CELL_COUNT) {
    throw new RangeError('Expected an 81-character Sudoku grid string');
  }

  const cells = new Array(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const character = grid[index];
    if (character === '.' || character === '0') {
      cells[index] = 0;
    } else if (character >= '1' && character <= '9') {
      cells[index] = Number(character);
    } else {
      throw new RangeError('Sudoku grid must contain digits, zeroes, or dots');
    }
  }
  return cells;
}

function buildMasks(cells) {
  const rows = new Array(GRID_SIZE).fill(0);
  const columns = new Array(GRID_SIZE).fill(0);
  const boxes = new Array(GRID_SIZE).fill(0);

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const digit = cells[index];
    if (digit === 0) {
      continue;
    }

    const row = Math.floor(index / GRID_SIZE);
    const column = index % GRID_SIZE;
    const box = boxIndex(row, column);
    const bit = 1 << (digit - 1);
    if ((rows[row] & bit) || (columns[column] & bit) || (boxes[box] & bit)) {
      return null;
    }
    rows[row] |= bit;
    columns[column] |= bit;
    boxes[box] |= bit;
  }

  return { rows, columns, boxes };
}

function bitCount(mask) {
  let count = 0;
  let value = mask;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function candidateMask(index, rows, columns, boxes) {
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  return FULL_MASK & ~(rows[row] | columns[column] | boxes[boxIndex(row, column)]);
}

function findBestEmptyCell(cells, rows, columns, boxes) {
  let bestIndex = -1;
  let bestMask = 0;
  let bestCount = GRID_SIZE + 1;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (cells[index] !== 0) {
      continue;
    }

    const mask = candidateMask(index, rows, columns, boxes);
    const count = bitCount(mask);
    if (count === 0) {
      return { index, mask, count };
    }
    if (count < bestCount) {
      bestIndex = index;
      bestMask = mask;
      bestCount = count;
      if (count === 1) {
        break;
      }
    }
  }

  return { index: bestIndex, mask: bestMask, count: bestCount };
}

export function countSolutions(grid, limit = 2) {
  const cells = parseGrid(grid);
  const masks = buildMasks(cells);
  if (!masks) {
    return 0;
  }

  const { rows, columns, boxes } = masks;

  function search() {
    const best = findBestEmptyCell(cells, rows, columns, boxes);
    if (best.index === -1) {
      return 1;
    }
    if (best.count === 0) {
      return 0;
    }

    const index = best.index;
    const row = Math.floor(index / GRID_SIZE);
    const column = index % GRID_SIZE;
    const box = boxIndex(row, column);
    let mask = best.mask;
    let total = 0;

    while (mask) {
      const bit = mask & -mask;
      const digit = DIGIT_BY_BIT.get(bit);
      cells[index] = digit;
      rows[row] |= bit;
      columns[column] |= bit;
      boxes[box] |= bit;

      total += search();

      cells[index] = 0;
      rows[row] &= ~bit;
      columns[column] &= ~bit;
      boxes[box] &= ~bit;

      if (total >= limit) {
        return total;
      }
      mask &= mask - 1;
    }

    return total;
  }

  return search();
}

export function clueCount(grid) {
  return parseGrid(grid).filter(Boolean).length;
}

export function isValidSolution(grid) {
  let cells;
  try {
    cells = parseGrid(grid);
  } catch {
    return false;
  }

  if (cells.some((cell) => cell === 0)) {
    return false;
  }

  return buildMasks(cells) !== null;
}

export function puzzleMatchesSolution(puzzle, solution) {
  const puzzleCells = parseGrid(puzzle);
  const solutionCells = parseGrid(solution);

  return puzzleCells.every((cell, index) => cell === 0 || cell === solutionCells[index]);
}

function makePuzzle(solution, seedInput, targetClues) {
  const random = seededRandom(seedInput);
  const cells = solution.split('');
  const removalOrder = shuffled(
    Array.from({ length: CELL_COUNT }, (_, index) => index),
    random
  );

  let clues = CELL_COUNT;
  for (const index of removalOrder) {
    if (clues <= targetClues) {
      break;
    }

    const previousValue = cells[index];
    cells[index] = '0';
    const candidate = cells.join('');
    if (countSolutions(candidate, 2) === 1) {
      clues -= 1;
    } else {
      cells[index] = previousValue;
    }
  }

  return cells.join('');
}

export function puzzleSettingsForDate(dateString) {
  assertValidDateString(dateString);

  if (dateString >= HARD_PUZZLE_START_DATE) {
    return {
      difficulty: HARD_DIFFICULTY,
      targetClues: HARD_TARGET_CLUES
    };
  }

  return {
    difficulty: MEDIUM_DIFFICULTY,
    targetClues: MEDIUM_TARGET_CLUES
  };
}

function buildPuzzleForDate(dateString, targetClues) {
  let best = null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const seedInput = `daily-sudoku:${dateString}:${attempt}`;
    const solution = createSolvedGrid(`${seedInput}:solution`);
    const puzzle = makePuzzle(solution, `${seedInput}:puzzle`, targetClues);
    const clues = clueCount(puzzle);

    if (clues === targetClues) {
      return { puzzle, solution };
    }

    if (!best || clues < best.clues) {
      best = { puzzle, solution, clues };
    }
  }

  return { puzzle: best.puzzle, solution: best.solution };
}

export function generateSudokuForDate(dateString = todayInLondon()) {
  assertValidDateString(dateString);
  const settings = puzzleSettingsForDate(dateString);
  const { puzzle, solution } = buildPuzzleForDate(dateString, settings.targetClues);

  return {
    date: dateString,
    difficulty: settings.difficulty,
    puzzle,
    solution,
    created_at: `${dateString}T00:00:00.000Z`
  };
}

export const generateDailySudoku = generateSudokuForDate;

export function formatDateInLondon(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(toDate(value)).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayInLondon(value = new Date()) {
  return formatDateInLondon(value);
}

export function previousDate(dateString) {
  assertValidDateString(dateString);
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return formatUtcDate(date);
}

export const previousDay = previousDate;

function normalizeRoutePath(route) {
  const rawRoute = route == null ? '/' : String(route);
  const pathname = new URL(rawRoute, 'https://daily-sudoku.local').pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

export function dateForRoute(route, value = new Date()) {
  const pathname = normalizeRoutePath(route);
  if (pathname === '/' || pathname === '/history') {
    return todayInLondon(value);
  }

  const match = pathname.match(ROUTE_PATTERN);
  if (!match) {
    return null;
  }

  if (match[1] === 'today') {
    return todayInLondon(value);
  }

  return isValidDateString(match[1]) ? match[1] : null;
}

export function isSupportedRoute(route) {
  try {
    return dateForRoute(route) !== null;
  } catch {
    return false;
  }
}
