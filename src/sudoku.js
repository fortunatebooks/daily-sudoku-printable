import { getSudokuConfig } from './sudoku-config.js';

const SUDOKU_CONFIG = getSudokuConfig();

export const LONDON_TIME_ZONE = 'Europe/London';
export const HARD_PUZZLE_START_DATE = SUDOKU_CONFIG.startDate;
export const MEDIUM_DIFFICULTY = SUDOKU_CONFIG.difficultyLevels.medium.label;
export const VERY_DIFFICULT_DIFFICULTY = SUDOKU_CONFIG.difficultyLevels['very-difficult'].label;
export const FIENDISH_DIFFICULTY = SUDOKU_CONFIG.difficultyLevels.fiendish.label;
export const SUPER_FIENDISH_DIFFICULTY = SUDOKU_CONFIG.difficultyLevels['super-fiendish'].label;
export const HARD_DIFFICULTY = FIENDISH_DIFFICULTY;
export const MEDIUM_TARGET_CLUES = SUDOKU_CONFIG.difficultyLevels.medium.targetClues;
export const HARD_TARGET_CLUES = SUDOKU_CONFIG.difficultyLevels['very-difficult'].targetClues;
export const DIFFICULTY = MEDIUM_DIFFICULTY;
export const TARGET_CLUES = MEDIUM_TARGET_CLUES;

const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const BOX_SIZE = 3;
const FULL_MASK = 0x1ff;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE_PATTERN = /^\/(?:puzzle|print|pdf)\/([^/]+)$/;
const MAX_GRADED_ATTEMPTS = SUDOKU_CONFIG.grader.maxGradedAttempts;
const SINGLE_SCORE_CAP = SUDOKU_CONFIG.grader.singleScoreCap;
const TECHNIQUE_WEIGHTS = new Map(Object.entries(SUDOKU_CONFIG.grader.techniqueWeights));
const TECHNIQUE_LABELS = new Map([
  ['naked-single', 'Naked single'],
  ['hidden-single', 'Hidden single'],
  ['locked-candidate', 'Locked candidate'],
  ['naked-pair', 'Naked pair'],
  ['hidden-pair', 'Hidden pair'],
  ['naked-triple', 'Naked triple'],
  ['hidden-triple', 'Hidden triple'],
  ['x-wing', 'X-Wing'],
  ['unsolved-without-guessing', 'Guessing required']
]);

const DIGIT_BY_BIT = new Map();
for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
  DIGIT_BY_BIT.set(1 << (digit - 1), digit);
}

const UNITS = buildUnits();
const PEERS = buildPeers();

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

function buildUnits() {
  const units = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    units.push(Array.from({ length: GRID_SIZE }, (_, column) => row * GRID_SIZE + column));
  }

  for (let column = 0; column < GRID_SIZE; column += 1) {
    units.push(Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + column));
  }

  for (let boxRow = 0; boxRow < BOX_SIZE; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < BOX_SIZE; boxColumn += 1) {
      units.push(
        Array.from({ length: GRID_SIZE }, (_, index) => {
          const row = boxRow * BOX_SIZE + Math.floor(index / BOX_SIZE);
          const column = boxColumn * BOX_SIZE + (index % BOX_SIZE);
          return row * GRID_SIZE + column;
        })
      );
    }
  }

  return units;
}

function buildPeers() {
  return Array.from({ length: CELL_COUNT }, (_, index) => {
    const peers = new Set();

    for (const unit of UNITS) {
      if (!unit.includes(index)) {
        continue;
      }

      unit.forEach((peer) => {
        if (peer !== index) {
          peers.add(peer);
        }
      });
    }

    return peers;
  });
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

export function gradeSudokuPuzzle(grid) {
  const state = createHumanSolveState(grid);
  const steps = [];

  if (!state) {
    return buildGrade({ steps, solved: false, invalid: true });
  }

  while (!state.invalid && !isSolvedState(state) && steps.length < 500) {
    const step =
      applyNakedSingle(state) ||
      applyHiddenSingle(state) ||
      applyLockedCandidate(state) ||
      applyNakedSubset(state, 2) ||
      applyHiddenSubset(state, 2) ||
      applyNakedSubset(state, 3) ||
      applyHiddenSubset(state, 3) ||
      applyXWing(state);

    if (!step) {
      break;
    }

    steps.push(step);
  }

  if (!state.invalid && !isSolvedState(state)) {
    steps.push({
      technique: 'unsolved-without-guessing',
      changed: 0
    });
  }

  return buildGrade({
    steps,
    solved: !state.invalid && isSolvedState(state),
    invalid: state.invalid
  });
}

function createHumanSolveState(grid) {
  const cells = parseGrid(grid);
  const masks = buildMasks(cells);

  if (!masks) {
    return null;
  }

  const candidates = cells.map((cell, index) =>
    cell === 0 ? candidateMask(index, masks.rows, masks.columns, masks.boxes) : 0
  );

  if (candidates.some((mask, index) => cells[index] === 0 && mask === 0)) {
    return null;
  }

  return {
    cells,
    candidates,
    invalid: false
  };
}

function isSolvedState(state) {
  return state.cells.every(Boolean);
}

function setHumanCell(state, index, digit) {
  if (state.cells[index] === digit) {
    return true;
  }

  if (state.cells[index] !== 0 || !(state.candidates[index] & bitForDigit(digit))) {
    state.invalid = true;
    return false;
  }

  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  const box = boxIndex(row, column);

  state.cells[index] = digit;
  state.candidates[index] = 0;

  for (const peer of PEERS[index]) {
    if (state.cells[peer] === digit) {
      state.invalid = true;
      return false;
    }

    eliminateCandidates(state, peer, bitForDigit(digit));
  }

  for (let peer = 0; peer < CELL_COUNT; peer += 1) {
    if (peer === index || state.cells[peer] === 0) {
      continue;
    }

    const peerRow = Math.floor(peer / GRID_SIZE);
    const peerColumn = peer % GRID_SIZE;
    if (peerRow === row || peerColumn === column || boxIndex(peerRow, peerColumn) === box) {
      continue;
    }
  }

  return !state.invalid;
}

function eliminateCandidates(state, index, mask) {
  if (state.cells[index] !== 0 || state.invalid) {
    return 0;
  }

  const previous = state.candidates[index];
  const next = previous & ~mask;

  if (next === previous) {
    return 0;
  }

  state.candidates[index] = next;

  if (next === 0) {
    state.invalid = true;
  }

  return bitCount(previous ^ next);
}

function bitForDigit(digit) {
  return 1 << (digit - 1);
}

function digitsForMask(mask) {
  const digits = [];
  let value = mask;

  while (value) {
    const bit = value & -value;
    digits.push(DIGIT_BY_BIT.get(bit));
    value &= value - 1;
  }

  return digits;
}

function applyNakedSingle(state) {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (state.cells[index] !== 0 || bitCount(state.candidates[index]) !== 1) {
      continue;
    }

    const digit = DIGIT_BY_BIT.get(state.candidates[index]);
    setHumanCell(state, index, digit);
    return {
      technique: 'naked-single',
      placements: [{ index, digit }],
      changed: 1
    };
  }

  return null;
}

function applyHiddenSingle(state) {
  for (const unit of UNITS) {
    for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
      const bit = bitForDigit(digit);
      const positions = unit.filter((index) => state.cells[index] === 0 && (state.candidates[index] & bit));

      if (positions.length === 1) {
        setHumanCell(state, positions[0], digit);
        return {
          technique: 'hidden-single',
          placements: [{ index: positions[0], digit }],
          changed: 1
        };
      }
    }
  }

  return null;
}

function applyLockedCandidate(state) {
  for (let box = 0; box < GRID_SIZE; box += 1) {
    const unit = boxUnit(box);

    for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
      const bit = bitForDigit(digit);
      const positions = unit.filter((index) => state.cells[index] === 0 && (state.candidates[index] & bit));

      if (positions.length < 2) {
        continue;
      }

      const rows = uniqueValues(positions.map((index) => Math.floor(index / GRID_SIZE)));
      const columns = uniqueValues(positions.map((index) => index % GRID_SIZE));

      if (rows.length === 1) {
        const changed = eliminateFromIndexes(
          state,
          rowUnit(rows[0]).filter((index) => !unit.includes(index)),
          bit
        );
        if (changed > 0) {
          return { technique: 'locked-candidate', digit, changed };
        }
      }

      if (columns.length === 1) {
        const changed = eliminateFromIndexes(
          state,
          columnUnit(columns[0]).filter((index) => !unit.includes(index)),
          bit
        );
        if (changed > 0) {
          return { technique: 'locked-candidate', digit, changed };
        }
      }
    }
  }

  for (let unitIndex = 0; unitIndex < GRID_SIZE * 2; unitIndex += 1) {
    const unit = UNITS[unitIndex];

    for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
      const bit = bitForDigit(digit);
      const positions = unit.filter((index) => state.cells[index] === 0 && (state.candidates[index] & bit));

      if (positions.length < 2) {
        continue;
      }

      const boxes = uniqueValues(
        positions.map((index) => boxIndex(Math.floor(index / GRID_SIZE), index % GRID_SIZE))
      );

      if (boxes.length === 1) {
        const changed = eliminateFromIndexes(
          state,
          boxUnit(boxes[0]).filter((index) => !unit.includes(index)),
          bit
        );
        if (changed > 0) {
          return { technique: 'locked-candidate', digit, changed };
        }
      }
    }
  }

  return null;
}

function applyNakedSubset(state, size) {
  for (const unit of UNITS) {
    const cells = unit.filter((index) => {
      const count = bitCount(state.candidates[index]);
      return state.cells[index] === 0 && count >= 2 && count <= size;
    });

    for (const indexes of combinations(cells, size)) {
      const unionMask = indexes.reduce((mask, index) => mask | state.candidates[index], 0);

      if (bitCount(unionMask) !== size) {
        continue;
      }

      const changed = eliminateFromIndexes(
        state,
        unit.filter((index) => !indexes.includes(index)),
        unionMask
      );

      if (changed > 0) {
        return {
          technique: size === 2 ? 'naked-pair' : 'naked-triple',
          changed
        };
      }
    }
  }

  return null;
}

function applyHiddenSubset(state, size) {
  const digits = Array.from({ length: GRID_SIZE }, (_, index) => index + 1);

  for (const unit of UNITS) {
    for (const subset of combinations(digits, size)) {
      const digitMask = subset.reduce((mask, digit) => mask | bitForDigit(digit), 0);
      const digitPositions = subset.map((digit) =>
        unit.filter((index) => state.cells[index] === 0 && (state.candidates[index] & bitForDigit(digit)))
      );

      if (digitPositions.some((positions) => positions.length === 0)) {
        continue;
      }

      const uniquePositions = [...new Set(digitPositions.flat())];

      if (uniquePositions.length !== size) {
        continue;
      }

      const changed = uniquePositions.reduce((total, index) => {
        const removable = state.candidates[index] & ~digitMask;
        return total + eliminateCandidates(state, index, removable);
      }, 0);

      if (changed > 0) {
        return {
          technique: size === 2 ? 'hidden-pair' : 'hidden-triple',
          changed
        };
      }
    }
  }

  return null;
}

function applyXWing(state) {
  for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
    const bit = bitForDigit(digit);
    const rowPatterns = [];

    for (let row = 0; row < GRID_SIZE; row += 1) {
      const columns = rowUnit(row)
        .filter((index) => state.cells[index] === 0 && (state.candidates[index] & bit))
        .map((index) => index % GRID_SIZE);
      if (columns.length === 2) {
        rowPatterns.push({ row, columns });
      }
    }

    for (const pair of combinations(rowPatterns, 2)) {
      if (pair[0].columns.join(',') !== pair[1].columns.join(',')) {
        continue;
      }

      const changed = eliminateFromIndexes(
        state,
        pair[0].columns.flatMap((column) =>
          columnUnit(column).filter((index) => {
            const row = Math.floor(index / GRID_SIZE);
            return row !== pair[0].row && row !== pair[1].row;
          })
        ),
        bit
      );

      if (changed > 0) {
        return { technique: 'x-wing', digit, changed };
      }
    }

    const columnPatterns = [];

    for (let column = 0; column < GRID_SIZE; column += 1) {
      const rows = columnUnit(column)
        .filter((index) => state.cells[index] === 0 && (state.candidates[index] & bit))
        .map((index) => Math.floor(index / GRID_SIZE));
      if (rows.length === 2) {
        columnPatterns.push({ column, rows });
      }
    }

    for (const pair of combinations(columnPatterns, 2)) {
      if (pair[0].rows.join(',') !== pair[1].rows.join(',')) {
        continue;
      }

      const changed = eliminateFromIndexes(
        state,
        pair[0].rows.flatMap((row) =>
          rowUnit(row).filter((index) => {
            const column = index % GRID_SIZE;
            return column !== pair[0].column && column !== pair[1].column;
          })
        ),
        bit
      );

      if (changed > 0) {
        return { technique: 'x-wing', digit, changed };
      }
    }
  }

  return null;
}

function buildGrade(result) {
  const steps = result.steps || [];
  const techniqueCounts = {};
  let placementScore = 0;
  let singleScore = 0;
  let hardTechniqueScore = 0;
  let hardestTechnique = '';
  let hardestWeight = 0;
  let singleStepCount = 0;
  let nonSingleSteps = 0;

  for (const step of steps) {
    const weight = TECHNIQUE_WEIGHTS.get(step.technique) || 0;
    const isSingle = step.technique === 'naked-single' || step.technique === 'hidden-single';
    techniqueCounts[step.technique] = (techniqueCounts[step.technique] || 0) + 1;
    placementScore += weight;

    if (isSingle) {
      singleScore += weight;
      singleStepCount += 1;
    } else {
      hardTechniqueScore += weight;
    }

    if (weight > hardestWeight) {
      hardestWeight = weight;
      hardestTechnique = step.technique;
    }

    if (!isSingle) {
      nonSingleSteps += 1;
    }
  }

  const score = hardTechniqueScore + Math.min(singleScore, SINGLE_SCORE_CAP);
  const solvedWithoutGuessing = result.solved && hardestTechnique !== 'unsolved-without-guessing';
  const singlesOnly = solvedWithoutGuessing && nonSingleSteps === 0;
  const label = result.invalid
    ? 'Invalid'
    : gradeLabelFor({
        hardestTechnique,
        hardestWeight,
        hardTechniqueScore,
        nonSingleSteps,
        score,
        singlesOnly,
        solvedWithoutGuessing
      });

  return {
    invalid: Boolean(result.invalid),
    label,
    score,
    placementScore,
    singleScore,
    hardTechniqueScore,
    solvedWithoutGuessing,
    singlesOnly,
    hardestTechnique,
    hardestTechniqueLabel: TECHNIQUE_LABELS.get(hardestTechnique) || '',
    hardestWeight,
    singleStepCount,
    nonSingleSteps,
    stepCount: steps.length,
    techniqueCounts,
    steps
  };
}

function gradeLabelFor(metrics) {
  if (!metrics.solvedWithoutGuessing) {
    return 'Solver Stuck';
  }

  if (metrics.singlesOnly) {
    return 'Too Easy';
  }

  if (
    metrics.hardestTechnique === 'x-wing' ||
    metrics.hardestWeight >= 24
  ) {
    return SUPER_FIENDISH_DIFFICULTY;
  }

  if (
    metrics.hardestWeight >= 14 ||
    metrics.nonSingleSteps >= 3 ||
    metrics.hardTechniqueScore >= 42
  ) {
    return FIENDISH_DIFFICULTY;
  }

  if (
    metrics.hardestWeight >= 10 ||
    metrics.nonSingleSteps >= 1 ||
    metrics.hardTechniqueScore >= 10
  ) {
    return VERY_DIFFICULT_DIFFICULTY;
  }

  return 'Too Easy';
}

function eliminateFromIndexes(state, indexes, mask) {
  return indexes.reduce((total, index) => total + eliminateCandidates(state, index, mask), 0);
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function rowUnit(row) {
  return UNITS[row];
}

function columnUnit(column) {
  return UNITS[GRID_SIZE + column];
}

function boxUnit(box) {
  return UNITS[GRID_SIZE * 2 + box];
}

function combinations(values, size) {
  const result = [];

  function visit(start, current) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (let index = start; index <= values.length - (size - current.length); index += 1) {
      current.push(values[index]);
      visit(index + 1, current);
      current.pop();
    }
  }

  visit(0, []);
  return result;
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

export function puzzleTargetsForDate(dateString, config = SUDOKU_CONFIG) {
  assertValidDateString(dateString);

  if (dateString < config.startDate) {
    return [targetFromConfig('medium', config)];
  }

  if (config.override.enabled) {
    return config.override.puzzles.map((id) => targetFromConfig(id, config));
  }

  const exactDateTargets = config.schedule.dates[dateString];
  if (exactDateTargets) {
    return exactDateTargets.map((id) => targetFromConfig(id, config));
  }

  const scheduledIds = isWeekendDate(dateString) ? config.schedule.weekends : config.schedule.weekdays;
  return scheduledIds.map((id) => targetFromConfig(id, config));
}

export function puzzleSettingsForDate(dateString) {
  const target = puzzleTargetsForDate(dateString)[0];

  return {
    difficulty: target.label,
    targetClues: target.targetClues
  };
}

function targetFromConfig(id, config = SUDOKU_CONFIG) {
  const level = config.difficultyLevels[id];
  if (!level) {
    throw new RangeError(`Unknown Sudoku difficulty target: ${id}`);
  }

  return {
    id,
    label: level.label,
    targetClues: level.targetClues,
    clueTargets: [...level.clueTargets],
    minScore: level.minScore,
    minHardestWeight: level.minHardestWeight,
    minNonSingleSteps: level.minNonSingleSteps,
    allowUnsolvedWithoutGuessing: level.allowUnsolvedWithoutGuessing
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

  return {
    puzzle: best.puzzle,
    solution: best.solution,
    clueCount: best.clues,
    reachedTargetClues: best.clues === targetClues
  };
}

function buildGradedPuzzleForTarget(dateString, target, number) {
  let best = null;

  for (let attempt = 0; attempt < MAX_GRADED_ATTEMPTS; attempt += 1) {
    const targetClues = target.clueTargets[attempt % target.clueTargets.length];
    const seedInput = `daily-sudoku:v${SUDOKU_CONFIG.seedVersion}:${dateString}:${target.id}:${number}:${attempt}`;
    const solution = createSolvedGrid(`${seedInput}:solution`);
    const puzzle = makePuzzle(solution, `${seedInput}:puzzle`, targetClues);
    const clues = clueCount(puzzle);
    const grade = gradeSudokuPuzzle(puzzle);
    const solutionCount = countSolutions(puzzle, 2);
    const candidate = {
      number,
      label: safeDisplayLabelFor(grade),
      requestedLabel: target.label,
      measuredLabel: grade.label,
      targetMet: false,
      fallbackReason: null,
      puzzle,
      solution,
      clueCount: clues,
      grade,
      generationAttempts: attempt + 1,
      solutionCount,
      fallback: false
    };

    if (candidateMatchesTarget(candidate, target)) {
      return finalizeCandidate(candidate, target, true);
    }

    if (!best || candidateRank(candidate, target) > candidateRank(best, target)) {
      best = candidate;
    }
  }

  return finalizeCandidate(best, target, false);
}

function candidateMatchesTarget(candidate, target) {
  const grade = candidate.grade;

  if (target.id === 'medium') {
    return candidate.clueCount === target.targetClues && candidate.solutionCount === 1;
  }

  if (grade.invalid || grade.singlesOnly || candidate.solutionCount !== 1) {
    return false;
  }

  if (!target.allowUnsolvedWithoutGuessing && !grade.solvedWithoutGuessing) {
    return false;
  }

  return (
    grade.score >= target.minScore &&
    grade.hardestWeight >= target.minHardestWeight &&
    grade.nonSingleSteps >= target.minNonSingleSteps
  );
}

function candidateRank(candidate, target) {
  const grade = candidate.grade;

  if (grade.invalid || candidate.solutionCount !== 1) {
    return Number.NEGATIVE_INFINITY;
  }

  const cluePenalty = Math.abs(candidate.clueCount - target.targetClues) * 3;
  const singlesPenalty = grade.singlesOnly ? 10000 : 0;
  const unsolvedPenalty = !target.allowUnsolvedWithoutGuessing && !grade.solvedWithoutGuessing ? 5000 : 0;

  return (
    grade.score +
    grade.hardTechniqueScore * 2 +
    grade.hardestWeight * 6 +
    grade.nonSingleSteps * 10 -
    cluePenalty -
    singlesPenalty -
    unsolvedPenalty
  );
}

function finalizeCandidate(candidate, target, targetMet) {
  const fallbackReason = targetMet ? null : fallbackReasonFor(candidate, target);

  return {
    ...candidate,
    label: targetMet ? target.label : safeDisplayLabelFor(candidate.grade),
    requestedLabel: target.label,
    measuredLabel: candidate.grade?.label || 'Invalid',
    targetMet,
    fallback: !targetMet,
    fallbackReason
  };
}

function safeDisplayLabelFor(grade) {
  if (!grade || grade.invalid) {
    return 'Invalid';
  }

  if (grade.singlesOnly) {
    return 'Too Easy';
  }

  if (!grade.solvedWithoutGuessing) {
    return FIENDISH_DIFFICULTY;
  }

  return grade.label;
}

function fallbackReasonFor(candidate, target) {
  const grade = candidate.grade;
  const reasons = [];

  if (!grade || grade.invalid) {
    reasons.push('grade invalid');
  }
  if (candidate.solutionCount !== 1) {
    reasons.push(`solution count ${candidate.solutionCount}`);
  }
  if (grade?.singlesOnly) {
    reasons.push('singles only');
  }
  if (grade && !target.allowUnsolvedWithoutGuessing && !grade.solvedWithoutGuessing) {
    reasons.push('solver stuck');
  }
  if (grade && grade.score < target.minScore) {
    reasons.push(`score ${grade.score} below ${target.minScore}`);
  }
  if (grade && grade.hardestWeight < target.minHardestWeight) {
    reasons.push(`hardest weight ${grade.hardestWeight} below ${target.minHardestWeight}`);
  }
  if (grade && grade.nonSingleSteps < target.minNonSingleSteps) {
    reasons.push(`non-single steps ${grade.nonSingleSteps} below ${target.minNonSingleSteps}`);
  }

  return reasons.length > 0 ? reasons.join('; ') : 'target missed';
}

function isWeekendDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function generateSudokuForDate(dateString = todayInLondon()) {
  assertValidDateString(dateString);
  const targets = puzzleTargetsForDate(dateString);
  const legacyPuzzle =
    targets.length === 1 && targets[0].id === 'medium'
      ? buildPuzzleForDate(dateString, targets[0].targetClues)
      : null;
  const puzzles =
    legacyPuzzle
      ? [
          {
            number: 1,
            label: targets[0].label,
            requestedLabel: targets[0].label,
            measuredLabel: targets[0].label,
            targetMet: legacyPuzzle.reachedTargetClues,
            fallbackReason: legacyPuzzle.reachedTargetClues
              ? null
              : `clue count ${legacyPuzzle.clueCount} did not reach ${targets[0].targetClues}`,
            ...legacyPuzzle,
            grade: null,
            generationAttempts: null,
            fallback: !legacyPuzzle.reachedTargetClues
          }
        ]
      : targets.map((target, index) => buildGradedPuzzleForTarget(dateString, target, index + 1));
  const primary = puzzles[0];

  return {
    date: dateString,
    difficulty: primary.label,
    puzzle: primary.puzzle,
    solution: primary.solution,
    puzzles,
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
