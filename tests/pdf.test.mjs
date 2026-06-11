import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSudokuPdfBytes, sudokuPdfFilename } from '../src/pdf.js';
import { generateDailySudoku } from '../src/sudoku.js';

test('builds an A4 Sudoku PDF with predictable filename', () => {
  const puzzle = generateDailySudoku('2026-06-11');
  const weather = {
    days: [
      {
        dateIso: '2026-06-11',
        icon: 'cloud',
        label: 'Partly cloudy',
        highC: 18,
        lowC: 11,
        rainyPeriodsLabel: 'Rain likely: evening',
        sunrise: '04:50',
        sunset: '21:18',
        moonPhase: 'Waning crescent'
      },
      {
        dateIso: '2026-06-12',
        icon: 'rain',
        label: 'Light rain',
        highC: 17,
        lowC: 10,
        rainyPeriodsLabel: 'Rain likely: morning',
        sunrise: '04:50',
        sunset: '21:19',
        moonPhase: 'Waning crescent'
      },
      {
        dateIso: '2026-06-13',
        icon: 'sun',
        label: 'Sunny',
        highC: 20,
        lowC: 12,
        rainyPeriodsLabel: 'Rain likely: none expected',
        sunrise: '04:49',
        sunset: '21:19',
        moonPhase: 'New moon'
      }
    ],
    attribution: 'Weather: Open-Meteo'
  };
  const tvListings = {
    sourceLabel: 'TV: Freely',
    windowLabel: '19:00-23:00',
    channels: [
      {
        name: 'BBC One South',
        programs: [
          { startTime: '19:00', title: 'EastEnders' },
          { startTime: '20:00', title: 'Sort Your Life Out' }
        ]
      },
      { name: 'BBC Two', programs: [{ startTime: '19:00', title: 'Springwatch' }] },
      { name: 'ITV1', programs: [] },
      { name: 'Channel 4', programs: [] },
      { name: '5', programs: [] }
    ]
  };
  const bytes = buildSudokuPdfBytes(puzzle, puzzle.date, { weather, tvListings });
  const text = new TextDecoder('ascii').decode(bytes);

  assert.equal(sudokuPdfFilename(puzzle.date), 'sudoku-2026-06-11.pdf');
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(text, /57\.64 270 m 537\.64 270 l/);
  assert.match(text, /\/F1 32 Tf/);
  assert.match(text, /Jenny's Sudoku/);
  assert.match(text, /Thursday, 11 June 2026/);
  assert.doesNotMatch(text, /Christchurch Weather/);
  assert.match(text, /Today/);
  assert.match(text, /Partly cloudy/);
  assert.match(text, /18\/11 C Rain evening/);
  assert.match(text, /Sun 04:50-21:18 Moon Waning crescent/);
  assert.match(text, /Fri 12 Jun/);
  assert.match(text, /Light rain/);
  assert.doesNotMatch(text, /Weather: Open-Meteo/);
  assert.match(text, /Tonight on TV 19:00-23:00/);
  assert.doesNotMatch(text, /TV: Freely/);
  assert.match(text, /BBC One South/);
  assert.match(text, /19:00 EastEnders/);
  assert.match(text, /20:00 Sort Your Life Out/);
  assert.match(text, /BBC Two/);
  assert.match(text, /19:00 Springwatch/);
  assert.doesNotMatch(text, /Notes:/);
  assert.doesNotMatch(text, /Finished in:/);
  assert.doesNotMatch(text, /Difficulty:/);
});
