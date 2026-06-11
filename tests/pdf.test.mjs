import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSudokuPdfBytes, sudokuPdfFilename } from '../src/pdf.js';
import { generateDailySudoku } from '../src/sudoku.js';

test('builds an A4 Sudoku PDF with predictable filename', () => {
  const puzzle = generateDailySudoku('2026-06-11');
  const bytes = buildSudokuPdfBytes(puzzle, puzzle.date);
  const text = new TextDecoder('ascii').decode(bytes);

  assert.equal(sudokuPdfFilename(puzzle.date), 'sudoku-2026-06-11.pdf');
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(text, /510 w|510 0 l|552\.64/);
  assert.match(text, /Daily Sudoku/);
  assert.match(text, /Thursday, 11 June 2026/);
});

