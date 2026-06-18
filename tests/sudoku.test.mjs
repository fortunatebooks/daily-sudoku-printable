import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIENDISH_DIFFICULTY,
  HARD_TARGET_CLUES,
  MEDIUM_TARGET_CLUES,
  SUPER_FIENDISH_DIFFICULTY,
  TARGET_CLUES,
  VERY_DIFFICULT_DIFFICULTY,
  clueCount,
  countSolutions,
  dateForRoute,
  formatDateInLondon,
  generateDailySudoku,
  gradeSudokuPuzzle,
  isSupportedRoute,
  isValidSolution,
  previousDate,
  puzzleTargetsForDate,
  puzzleSettingsForDate,
  puzzleMatchesSolution,
  todayInLondon
} from '../src/sudoku.js';

const TOO_EASY_BASELINE_PUZZLE =
  '579000800000008000801005036000009020003006180004870000302600000000020008008007390';

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

test('rejects invalid date strings', () => {
  assert.throws(() => generateDailySudoku('2026-02-30'), RangeError);
  assert.throws(() => generateDailySudoku('06/11/2026'), RangeError);
});

test('formats dates using the Europe/London calendar day', () => {
  const lateUtcDuringBst = new Date('2026-06-10T23:30:00.000Z');

  assert.equal(formatDateInLondon(lateUtcDuringBst), '2026-06-11');
  assert.equal(todayInLondon(lateUtcDuringBst), '2026-06-11');
});

test('gets previous calendar day for date strings', () => {
  assert.equal(previousDate('2026-01-01'), '2025-12-31');
  assert.equal(previousDate('2026-03-01'), '2026-02-28');
  assert.equal(previousDate('2024-03-01'), '2024-02-29');
});

test('resolves supported route dates', () => {
  const lateUtcDuringBst = new Date('2026-06-10T23:30:00.000Z');

  assert.equal(dateForRoute('/', lateUtcDuringBst), '2026-06-11');
  assert.equal(dateForRoute('/print/today?download=1', lateUtcDuringBst), '2026-06-11');
  assert.equal(dateForRoute('/pdf/today', lateUtcDuringBst), '2026-06-11');
  assert.equal(dateForRoute('/history', lateUtcDuringBst), '2026-06-11');
  assert.equal(dateForRoute('/puzzle/2026-07-04'), '2026-07-04');
  assert.equal(dateForRoute('/print/2026-07-04/'), '2026-07-04');
  assert.equal(dateForRoute('/assets/app.css'), null);
  assert.equal(isSupportedRoute('/puzzle/2026-07-04'), true);
  assert.equal(isSupportedRoute('/history'), true);
  assert.equal(isSupportedRoute('/assets/app.css'), false);
  assert.equal(isSupportedRoute('/puzzle/2026-02-30'), false);
  assert.equal(dateForRoute('/puzzle/2026-02-30'), null);
});
