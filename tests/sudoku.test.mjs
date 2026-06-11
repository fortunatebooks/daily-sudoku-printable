import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TARGET_CLUES,
  clueCount,
  countSolutions,
  dateForRoute,
  formatDateInLondon,
  generateDailySudoku,
  isSupportedRoute,
  isValidSolution,
  previousDate,
  puzzleMatchesSolution,
  todayInLondon
} from '../src/sudoku.js';

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
  assert.equal(isValidSolution(daily.solution), true);
  assert.equal(puzzleMatchesSolution(daily.puzzle, daily.solution), true);
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
  assert.throws(() => dateForRoute('/puzzle/2026-02-30'), RangeError);
});
