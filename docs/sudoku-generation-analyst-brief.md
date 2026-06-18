# Jenny's Sudoku Generation Analyst Brief

This document is for a separate analyst with no project context. It explains the current Sudoku puzzle generation and difficulty grading system for Jenny's Sudoku, why it exists, what problems it is trying to solve, how it currently works, where it may be weak, and what we would like reviewed.

This brief focuses only on Sudoku generation, uniqueness checks, ranking, and grading. It does not cover PDF rendering, weather, TV listings, printing automation, or frontend styling except where those surfaces consume the generated puzzle data.

## Project Context

Jenny's Sudoku is a small daily printable puzzle site at `jennysudoku.com`. A local iMac automatically downloads and prints the daily PDF every morning. The recipient solves the printed sheet.

The page originally generated one daily Sudoku. It was then changed to generate harder puzzles because the recipient found the previous puzzles far too easy. The target now is:

- Two puzzles per day.
- Weekdays: one `Very Difficult`, one `Fiendish`.
- Saturdays and Sundays: one `Fiendish`, one `Super Fiendish`.
- Deterministic daily output: the same date must always produce the same puzzles.
- Each puzzle must have a unique solution.
- Puzzle difficulty should be closer to newspaper-style grading, especially The Times-style labels such as `Very Difficult` and `Fiendish`.

Important note: we are not currently using or claiming to reproduce The Times' actual grading algorithm. The desired product behavior is "similar in feel to The Times hard puzzles", but the current implementation is our own deterministic generator plus a custom human-technique grader.

## Original Problem

The first generation system mostly controlled difficulty by clue count. It produced a valid puzzle with a target number of givens, but a 28-clue puzzle could still be trivial if it solved entirely by singles.

The practical problem reported by the user:

- The recipient completed a supposedly hard puzzle in about two minutes.
- The user compared it with The Times newspaper puzzles and noticed those often had about 28 pre-filled cells, but were much harder.
- Therefore, clue count alone is not enough. We need generated puzzles that require harder solving techniques.

The current system addresses this by:

- Preserving uniqueness checks.
- Generating many candidate puzzles per date/difficulty.
- Running a human-style solver/grader on each candidate.
- Rejecting candidates that are singles-only.
- Ranking candidates by score, hardest technique, non-single steps, and clue-count proximity.

## Current Public Data Shape

The generator returns one object per date. For backward compatibility, the first puzzle remains available at top-level fields.

Example shape:

```json
{
  "date": "2026-06-19",
  "difficulty": "Very Difficult",
  "puzzle": "170600004008009000020500197001200003090405700005700000007902300060057900010300000",
  "solution": "179623854358749216624581397781296543296435781435718629547962138863157492912384675",
  "puzzles": [
    {
      "number": 1,
      "label": "Very Difficult",
      "requestedLabel": "Very Difficult",
      "puzzle": "...81 chars...",
      "solution": "...81 chars...",
      "clueCount": 28,
      "grade": {
        "label": "Very Difficult",
        "score": 74,
        "solvedWithoutGuessing": true,
        "singlesOnly": false,
        "hardestTechnique": "locked-candidate",
        "hardestTechniqueLabel": "Locked candidate",
        "hardestWeight": 10,
        "nonSingleSteps": 2,
        "stepCount": 56,
        "techniqueCounts": {
          "naked-single": 40,
          "hidden-single": 14,
          "locked-candidate": 2
        }
      },
      "fallback": false
    },
    {
      "number": 2,
      "label": "Fiendish",
      "requestedLabel": "Fiendish",
      "puzzle": "...81 chars...",
      "solution": "...81 chars...",
      "clueCount": 27,
      "grade": {
        "label": "Fiendish",
        "score": 100,
        "solvedWithoutGuessing": true,
        "singlesOnly": false,
        "hardestTechnique": "naked-pair",
        "hardestTechniqueLabel": "Naked pair",
        "hardestWeight": 14,
        "nonSingleSteps": 4
      },
      "fallback": false
    }
  ],
  "created_at": "2026-06-19T00:00:00.000Z"
}
```

Notes:

- Empty cells are represented as `0` in the 81-character puzzle string.
- Filled cells are digits `1` to `9`.
- `solution` is the complete 81-character solved grid.
- `puzzles[]` is the new daily pair.
- Top-level `puzzle`, `solution`, and `difficulty` are retained for older callers and currently mirror `puzzles[0]`.

## Current Difficulty Schedule

The schedule is now configured in `src/sudoku-config.js`. This is a plain
JavaScript config module rather than YAML because the same generator runs in
both the browser and Node server without a bundler or runtime config loader.

```js
export const HARD_PUZZLE_START_DATE = '2026-06-18';
export const MEDIUM_DIFFICULTY = 'medium';
export const VERY_DIFFICULT_DIFFICULTY = 'Very Difficult';
export const FIENDISH_DIFFICULTY = 'Fiendish';
export const SUPER_FIENDISH_DIFFICULTY = 'Super Fiendish';
export const HARD_DIFFICULTY = FIENDISH_DIFFICULTY;
export const MEDIUM_TARGET_CLUES = 34;
export const HARD_TARGET_CLUES = 28;
export const DIFFICULTY = MEDIUM_DIFFICULTY;
export const TARGET_CLUES = MEDIUM_TARGET_CLUES;
```

Before `2026-06-18`, the system preserves the old one-puzzle behavior. From the
configured start date onward, target IDs are resolved from:

- `override.puzzles`, if `override.enabled` is true.
- `schedule.dates[date]`, if an exact date override exists.
- `schedule.weekends`, for Saturday/Sunday.
- `schedule.weekdays`, otherwise.

The current default schedule is:

```js
schedule: {
  weekdays: ['very-difficult', 'fiendish'],
  weekends: ['fiendish', 'super-fiendish'],
  dates: {}
}
```

The target resolver still exports `puzzleTargetsForDate(dateString)`, but it now
normalizes target objects from the config:

```js
function targetFromConfig(id, config = SUDOKU_CONFIG) {
  const level = config.difficultyLevels[id];

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
```

## Deterministic Randomness

Each date and target difficulty produces deterministic seeds. This means the generated output is stable across server restarts and redeployments.

The random generator is seeded with FNV-1a plus Mulberry32:

```js
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
```

## Solved Grid Generation

The solved grid is generated from a standard pattern, with shuffled row bands, rows within bands, column stacks, columns within stacks, and digit permutation.

```js
const GRID_SIZE = 9;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const BOX_SIZE = 3;

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
```

Potential issue to review:

- This method creates valid solved grids, but from a pattern-based family. It may not explore the full space of Sudoku solution grids. The puzzle-removal and grading stages may compensate enough for this use case, but an analyst should review whether solution-grid diversity matters here.

## Uniqueness Solver

The generator needs to verify that each puzzle has exactly one solution. It uses a backtracking solver with bitmasks and a "best empty cell" heuristic.

Grid parsing and masks:

```js
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
```

Solution counter:

```js
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
```

Validation helpers:

```js
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
```

## Puzzle Creation By Clue Removal

The solved grid starts full, then cells are removed in seeded random order. Each removal is kept only if the resulting puzzle remains uniquely solvable.

```js
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
```

Potential issue to review:

- This removal algorithm does not directly optimize for human difficulty. It creates unique puzzles near a target clue count, then the outer graded loop searches many candidates.
- It does not currently enforce symmetry in givens.
- It does not currently try multiple removal phases or targeted removal to force particular techniques.

## Human-Style Grader

The grader simulates a subset of human solving techniques. It is not a full human solver and not a proof that the puzzle feels exactly like a newspaper puzzle.

Technique weights:

```js
const TECHNIQUE_WEIGHTS = new Map([
  ['naked-single', 1],
  ['hidden-single', 2],
  ['locked-candidate', 10],
  ['naked-pair', 14],
  ['hidden-pair', 16],
  ['naked-triple', 24],
  ['hidden-triple', 28],
  ['x-wing', 38],
  ['unsolved-without-guessing', 52]
]);

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
```

Main grader loop:

```js
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
```

State initialization:

```js
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
```

Singles:

```js
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
```

Locked candidates:

```js
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
```

Pairs/triples:

```js
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
```

X-Wing:

```js
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
```

Grade construction:

```js
function buildGrade(result) {
  const steps = result.steps || [];
  const techniqueCounts = {};
  let score = 0;
  let hardestTechnique = '';
  let hardestWeight = 0;
  let nonSingleSteps = 0;

  for (const step of steps) {
    const weight = TECHNIQUE_WEIGHTS.get(step.technique) || 0;
    techniqueCounts[step.technique] = (techniqueCounts[step.technique] || 0) + 1;
    score += weight;

    if (weight > hardestWeight) {
      hardestWeight = weight;
      hardestTechnique = step.technique;
    }

    if (step.technique !== 'naked-single' && step.technique !== 'hidden-single') {
      nonSingleSteps += 1;
    }
  }

  const solvedWithoutGuessing = result.solved && hardestTechnique !== 'unsolved-without-guessing';
  const singlesOnly = solvedWithoutGuessing && nonSingleSteps === 0;
  const label = gradeLabelFor({ hardestTechnique, hardestWeight, nonSingleSteps, score, singlesOnly, solvedWithoutGuessing });

  return {
    invalid: Boolean(result.invalid),
    label,
    score,
    solvedWithoutGuessing,
    singlesOnly,
    hardestTechnique,
    hardestTechniqueLabel: TECHNIQUE_LABELS.get(hardestTechnique) || '',
    hardestWeight,
    nonSingleSteps,
    stepCount: steps.length,
    techniqueCounts,
    steps
  };
}

function gradeLabelFor(metrics) {
  if (metrics.singlesOnly) {
    return 'Too Easy';
  }

  if (!metrics.solvedWithoutGuessing || metrics.hardestTechnique === 'x-wing' || metrics.hardestWeight >= 24 || metrics.score >= 170) {
    return SUPER_FIENDISH_DIFFICULTY;
  }

  if (metrics.hardestWeight >= 14 || metrics.nonSingleSteps >= 3 || metrics.score >= 95) {
    return FIENDISH_DIFFICULTY;
  }

  if (metrics.hardestWeight >= 10 || metrics.nonSingleSteps >= 1 || metrics.score >= 65) {
    return VERY_DIFFICULT_DIFFICULTY;
  }

  return 'Too Easy';
}
```

Important behavior:

- Singles-only puzzles are labeled `Too Easy`.
- `Super Fiendish` can include puzzles that this limited solver cannot complete without guessing.
- `Very Difficult` starts at locked candidates or enough accumulated score.
- `Fiendish` starts at naked/hidden pairs or enough non-single work.
- Labels are current heuristics, not calibrated against a formal benchmark corpus.

## Candidate Search, Ranking, and Fallbacks

For current/future dates, each requested puzzle is generated by trying up to `MAX_GRADED_ATTEMPTS` candidates.

```js
const MAX_GRADED_ATTEMPTS = 260;
```

Main candidate loop:

```js
function buildGradedPuzzleForTarget(dateString, target, number) {
  let best = null;

  for (let attempt = 0; attempt < MAX_GRADED_ATTEMPTS; attempt += 1) {
    const targetClues = target.clueTargets[attempt % target.clueTargets.length];
    const seedInput = `daily-sudoku:${dateString}:${target.id}:${attempt}`;
    const solution = createSolvedGrid(`${seedInput}:solution`);
    const puzzle = makePuzzle(solution, `${seedInput}:puzzle`, targetClues);
    const clues = clueCount(puzzle);
    const grade = gradeSudokuPuzzle(puzzle);
    const candidate = {
      number,
      label: target.label,
      requestedLabel: target.label,
      puzzle,
      solution,
      clueCount: clues,
      grade,
      fallback: false
    };

    if (candidateMatchesTarget(candidate, target)) {
      return candidate;
    }

    if (!best || candidateRank(candidate, target) > candidateRank(best, target)) {
      best = candidate;
    }
  }

  return {
    ...best,
    label: fallbackLabelFor(best.grade, target),
    fallback: fallbackLabelFor(best.grade, target) !== target.label
  };
}
```

Acceptance:

```js
function candidateMatchesTarget(candidate, target) {
  const grade = candidate.grade;

  if (target.id === 'medium') {
    return candidate.clueCount === target.targetClues && countSolutions(candidate.puzzle, 2) === 1;
  }

  if (grade.invalid || grade.singlesOnly || countSolutions(candidate.puzzle, 2) !== 1) {
    return false;
  }

  if (target.id === 'super-fiendish' && !grade.solvedWithoutGuessing) {
    return true;
  }

  return grade.solvedWithoutGuessing && grade.score >= target.minScore && grade.hardestWeight >= target.minHardestWeight;
}
```

Ranking:

```js
function candidateRank(candidate, target) {
  const grade = candidate.grade;
  const cluePenalty = Math.abs(candidate.clueCount - target.targetClues) * 3;
  const unsolvedBonus = target.id === 'super-fiendish' && !grade.solvedWithoutGuessing && !grade.singlesOnly ? 70 : 0;
  const singlesPenalty = grade.singlesOnly ? 120 : 0;

  return grade.score + grade.hardestWeight * 6 + grade.nonSingleSteps * 10 + unsolvedBonus - cluePenalty - singlesPenalty;
}
```

Fallback labeling:

```js
function fallbackLabelFor(grade, target) {
  if (target.id === 'super-fiendish' && grade?.label !== SUPER_FIENDISH_DIFFICULTY) {
    return grade?.label || FIENDISH_DIFFICULTY;
  }

  return target.label;
}
```

Potential issue to review:

- `fallbackLabelFor` only downgrades `Super Fiendish`; it does not currently downgrade a failed `Fiendish` or `Very Difficult` fallback. In practice, tests check that generated puzzles are non-singles, but an analyst should review whether fallback labeling should be stricter for all targets.
- `candidateMatchesTarget` calls `countSolutions` again even though `makePuzzle` tries to preserve uniqueness. This is safer, but may be redundant and slower.

## Daily Generation Function

This is the central exported function used by the server, browser, PDF builder, and tests.

```js
export function generateSudokuForDate(dateString = todayInLondon()) {
  assertValidDateString(dateString);
  const targets = puzzleTargetsForDate(dateString);
  const puzzles =
    targets.length === 1 && targets[0].id === 'medium'
      ? [
          {
            number: 1,
            label: targets[0].label,
            requestedLabel: targets[0].label,
            ...buildPuzzleForDate(dateString, targets[0].targetClues),
            clueCount: targets[0].targetClues,
            grade: null,
            fallback: false
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
```

## Tests That Cover This System

The main tests live in `tests/sudoku.test.mjs`. Relevant coverage:

```js
test('generates the same puzzle and solution for the same date', () => {
  const first = generateDailySudoku('2026-06-11');
  const second = generateDailySudoku('2026-06-11');

  assert.deepEqual(second, first);
  assert.equal(first.date, '2026-06-11');
  assert.equal(first.difficulty, 'medium');
  assert.equal(first.created_at, '2026-06-11T00:00:00.000Z');
});

test('generates different puzzles for different dates', () => {
  const first = generateDailySudoku('2026-06-11');
  const second = generateDailySudoku('2026-06-12');

  assert.notEqual(second.puzzle, first.puzzle);
  assert.notEqual(second.solution, first.solution);
});

test('generates a valid medium-ish puzzle with a valid solution', () => {
  const daily = generateDailySudoku('2026-06-11');

  assert.equal(daily.puzzle.length, 81);
  assert.equal(daily.solution.length, 81);
  assert.equal(clueCount(daily.puzzle), TARGET_CLUES);
  assert.equal(clueCount(daily.puzzle), MEDIUM_TARGET_CLUES);
  assert.equal(isValidSolution(daily.solution), true);
  assert.equal(puzzleMatchesSolution(daily.puzzle, daily.solution), true);
});

test('generates hard puzzles from 18 June 2026', () => {
  const beforeChange = generateDailySudoku('2026-06-17');
  const firstHard = generateDailySudoku('2026-06-18');

  assert.equal(HARD_TARGET_CLUES, 28);
  assert.deepEqual(puzzleSettingsForDate('2026-06-17'), {
    difficulty: 'medium',
    targetClues: MEDIUM_TARGET_CLUES
  });
  assert.deepEqual(puzzleSettingsForDate('2026-06-18'), {
    difficulty: VERY_DIFFICULT_DIFFICULTY,
    targetClues: HARD_TARGET_CLUES
  });
  assert.equal(beforeChange.difficulty, 'medium');
  assert.equal(clueCount(beforeChange.puzzle), MEDIUM_TARGET_CLUES);
  assert.equal(firstHard.difficulty, VERY_DIFFICULT_DIFFICULTY);
  assert.equal(clueCount(firstHard.puzzle), HARD_TARGET_CLUES);
  assert.equal(isValidSolution(firstHard.solution), true);
  assert.equal(puzzleMatchesSolution(firstHard.puzzle, firstHard.solution), true);
  assert.equal(countSolutions(firstHard.puzzle, 2), 1);
});

test('generates two graded puzzles on weekdays and harder pairs on weekends', () => {
  const weekday = generateDailySudoku('2026-06-19');
  const weekend = generateDailySudoku('2026-06-20');

  assert.deepEqual(
    puzzleTargetsForDate('2026-06-19').map((target) => target.label),
    [VERY_DIFFICULT_DIFFICULTY, FIENDISH_DIFFICULTY]
  );
  assert.deepEqual(
    puzzleTargetsForDate('2026-06-20').map((target) => target.label),
    [FIENDISH_DIFFICULTY, SUPER_FIENDISH_DIFFICULTY]
  );
  assert.deepEqual(
    weekday.puzzles.map((puzzle) => puzzle.label),
    [VERY_DIFFICULT_DIFFICULTY, FIENDISH_DIFFICULTY]
  );
  assert.deepEqual(
    weekend.puzzles.map((puzzle) => puzzle.label),
    [FIENDISH_DIFFICULTY, SUPER_FIENDISH_DIFFICULTY]
  );

  for (const puzzle of [...weekday.puzzles, ...weekend.puzzles]) {
    assert.equal(puzzle.puzzle.length, 81);
    assert.equal(puzzle.solution.length, 81);
    assert.equal(countSolutions(puzzle.puzzle, 2), 1);
    assert.equal(puzzle.grade.singlesOnly, false);
    assert.equal(puzzle.grade.score > 0, true);
  }
});

test('grades the old 28-clue baseline as too easy', () => {
  const grade = gradeSudokuPuzzle(TOO_EASY_BASELINE_PUZZLE);

  assert.equal(grade.label, 'Too Easy');
  assert.equal(grade.singlesOnly, true);
  assert.equal(grade.solvedWithoutGuessing, true);
});

test('generated puzzle has a unique solution', () => {
  const daily = generateDailySudoku('2026-06-11');

  assert.equal(countSolutions(daily.puzzle, 2), 1);
});
```

The server API test also checks the new `puzzles[]` payload:

```js
const puzzleResponse = await fetch(`${baseUrl}/api/puzzle/2026-06-11`);
const gradedPuzzleResponse = await fetch(`${baseUrl}/api/puzzle/2026-06-19`);
const puzzle = await puzzleResponse.json();
const gradedPuzzle = await gradedPuzzleResponse.json();

assert.equal(puzzle.date, '2026-06-11');
assert.equal(puzzle.puzzle.length, 81);
assert.equal(puzzle.solution.length, 81);
assert.equal(Array.isArray(puzzle.puzzles), true);
assert.equal(puzzle.puzzles.length, 1);
assert.equal(gradedPuzzleResponse.status, 200);
assert.equal(gradedPuzzle.puzzles.length, 2);
assert.deepEqual(
  gradedPuzzle.puzzles.map((entry) => entry.label),
  ['Very Difficult', 'Fiendish']
);
```

## Known Weaknesses / Review Areas

1. Grading is heuristic.
   - The custom grader measures techniques it knows how to apply.
   - It does not model all newspaper-level human solving techniques.
   - It may label a puzzle hard because the limited solver gets stuck, when a human might find a different elegant route.

2. Difficulty labels are not calibrated against a corpus.
   - We do not currently have a set of known The Times `Difficult`, `Very Hard`, `Fiendish`, or `Super Fiendish` puzzles with official labels to calibrate against.
   - The current thresholds are educated heuristics.

3. Technique order affects grade.
   - The solver always applies techniques in a fixed order.
   - A different human-style solving order could produce different step counts and labels.

4. No uniqueness proof is cached.
   - `makePuzzle` checks uniqueness during removals.
   - `candidateMatchesTarget` checks uniqueness again.
   - This is safe but may be less efficient than necessary.

5. Limited puzzle construction strategy.
   - It removes clues randomly while preserving uniqueness.
   - It then searches for candidates that happen to require harder techniques.
   - It does not construct puzzles by deliberately forcing specific techniques.

6. The difficulty configuration is intentionally simple.
   - `src/sudoku-config.js` controls schedules, thresholds, seed version, and override behavior.
   - It is validated at module load so a bad edit fails loudly in tests/server startup.
   - It is not YAML; this avoids adding a parser and keeps browser/server generation identical.

## Human-Editable Difficulty Config

The implemented config lives in `src/sudoku-config.js`. The earlier YAML idea
was intentionally simplified to avoid a dependency and a build-time conversion
step.

Current config shape:

```js
{
  startDate: '2026-06-18',
  seedVersion: 1,
  override: {
    enabled: false,
    puzzles: ['fiendish', 'super-fiendish']
  },
  schedule: {
    weekdays: ['very-difficult', 'fiendish'],
    weekends: ['fiendish', 'super-fiendish'],
    dates: {}
  },
  difficultyLevels: {
    'very-difficult': {
      label: 'Very Difficult',
      targetClues: 28,
      clueTargets: [28, 27, 29, 30],
      minScore: 55,
      minHardestWeight: 10,
      minNonSingleSteps: 1,
      allowUnsolvedWithoutGuessing: false
    }
  }
}
```

Config behavior:

- If `override.enabled` is `true`, every date uses `override.puzzles`.
- If `override.enabled` is `false`, the system uses:
  - exact date override if present,
  - otherwise `schedule.weekends` for Saturday/Sunday,
  - otherwise `schedule.weekdays`.
- Difficulty level IDs map to `difficultyLevels`.
- Config is validated at module load.
- If config is invalid, the app fails loudly during tests/server start rather than silently printing easy puzzles.

## Possible Improvements To Consider

1. Add more solving techniques.
   - Pointing/claiming are covered as locked candidates.
   - Pairs/triples and X-Wing exist.
   - Missing possible techniques include swordfish, XY-wing, XYZ-wing, coloring/chains, finned fish, unique rectangles, jellyfish, forcing chains, and advanced ALS logic.

2. Calibrate against known puzzles.
   - Build a small test corpus of puzzles from reputable sources with labels.
   - Compare our grade output to known labels.
   - Adjust weights and thresholds based on mismatch.

3. Separate "rating" from "generation target".
   - A puzzle can have a measured grade that differs from the requested target.
   - The UI/PDF could show measured grade instead of requested label, or show both internally.

4. Improve candidate search.
   - Use a priority queue or batch generation.
   - Avoid repeated uniqueness checks where already proven.
   - Stop early only when a candidate clears a higher confidence threshold.
   - Generate candidate removals that intentionally create hard technique opportunities.

5. Improve diversity.
   - Enforce no repeated clue patterns across nearby dates.
   - Enforce rotational symmetry if aesthetically desired.
   - Track distribution of givens by box/row/column.

6. Maintain the difficulty audit script.
   - `npm run sudoku:audit -- --from 2026-06-18 --days 30`
   - `npm run sudoku:audit -- --from 2026-06-18 --days 365 --format csv`
   - `npm run sudoku:audit:ci`
   - The CI mode fails on uniqueness/solution/singles-only problems and warns on target downgrades by default.

7. Strengthen tests.
   - Test a larger range of dates.
   - Assert no generated current/future puzzle is singles-only.
   - Assert weekend puzzles are at least as hard as weekday puzzles by score/technique.
   - Add fixture puzzles for each technique.

## Questions For The Analyst

1. Do you see any correctness bugs in the solver, uniqueness checker, or candidate generation logic?

2. Are there any cases where `countSolutions` might return an incorrect result or miss a second solution?

3. Is the solved-grid generation method too limited because it uses a shuffled base pattern?

4. Is random clue removal plus rejection/ranking a reasonable approach for this small daily app, or should we use a different generator?

5. Are the current technique weights sensible?

6. Are the current thresholds for `Very Difficult`, `Fiendish`, and `Super Fiendish` sensible?

7. Should `Super Fiendish` accept puzzles the current human solver cannot solve without guessing, or should all displayed puzzles be solvable by implemented techniques?

8. Is the fixed solving technique order likely to mis-grade puzzles?

9. What additional techniques would most improve newspaper-style grading accuracy?

10. How would you calibrate this against The Times-style difficulty categories?

11. Should we add a corpus of known graded puzzles? If so, what size and sources would be enough?

12. Can the generation loop be made more efficient without making the system much more complex?

13. Should `fallbackLabelFor` downgrade all missed targets, not just `Super Fiendish`?

14. Should we show the requested label, measured label, or some combination on the printed PDF?

15. Should clue count remain part of the target, or should difficulty be driven mostly by measured technique profile?

16. Should we add symmetry or aesthetic constraints to the givens?

17. Is YAML the right format for the proposed human-editable config, or should this project use JSON/Markdown to avoid dependencies?

18. What validation rules should the config enforce so a bad edit does not accidentally make every puzzle too easy?

19. Should there be an "every day override" control for both puzzles, or separate override controls for Puzzle 1 and Puzzle 2?

20. What simple metrics should we log or expose so the user can see whether future puzzles are genuinely getting harder?
