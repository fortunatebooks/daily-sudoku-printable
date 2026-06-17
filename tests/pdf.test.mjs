import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSudokuPdfBytes, layoutTvListingsForPdf, sudokuPdfFilename } from '../src/pdf.js';
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
  assert.match(text, / 795\.89 Tm \(Jenny's Sudoku\) Tj ET/);
  assert.match(text, / 772\.89 Tm \(Thursday, 11 June 2026\) Tj ET/);
  assert.match(text, /2\.4 w 97\.64 350 m 97\.64 750 l S/);
  assert.match(text, /0\.6 w 34 34 m 561\.28 34 l S/);
  assert.match(text, /Jenny's Sudoku/);
  assert.match(text, /Thursday, 11 June 2026/);
  assert.doesNotMatch(text, /Christchurch Weather/);
  assert.doesNotMatch(text, /Christchurch weather/);
  assert.match(text, /Today/);
  assert.match(text, /Partly cloudy/);
  assert.match(text, /18\/11 C Rain evening/);
  assert.match(text, /Sun 04:50-21:18 Moon Waning crescent/);
  assert.match(text, /Fri 12 Jun/);
  assert.match(text, /Light rain/);
  assert.doesNotMatch(text, /Weather: Open-Meteo/);
  assert.doesNotMatch(text, /Tonight on TV 19:00-23:00/);
  assert.doesNotMatch(text, /TV: Freely/);
  assert.match(text, /BBC One/);
  assert.match(text, /EastEnders/);
  assert.match(text, /\(8:00\) Tj/);
  assert.match(text, /Sort Your/);
  assert.match(text, /Life Out/);
  assert.match(text, /BBC Two/);
  assert.match(text, /Springwatch/);
  assert.doesNotMatch(text, /Notes:/);
  assert.doesNotMatch(text, /Finished in:/);
  assert.doesNotMatch(text, /Difficulty:/);
});

test('lays out TV listings as five fitted PDF columns', () => {
  const layout = layoutTvListingsForPdf(
    {
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
    },
    { x: 34, y: 28, width: 527.28, height: 260 }
  );

  assert.equal(layout.columns.length, 5);
  assert.ok(layout.programmeFontSize >= 7.2);
  assert.ok(layout.channelFontSize > 0);
  assert.deepEqual(
    layout.columns.map((column) => column.heading),
    ['BBC One', 'BBC Two', 'ITV1', 'Channel 4', '5']
  );
  assert.match(layout.columns[0].entries.flatMap((entry) => entry.lines).join(' '), /EastEnders/);
});

test('does not ellipsize programme entries of 45 characters or fewer', () => {
  const title = 'Long But Readable Programme Title';
  const layout = layoutTvListingsForPdf(
    {
      channels: [
        {
          name: 'BBC One South',
          programs: [{ startTime: '19:00', title }]
        }
      ]
    },
    { x: 34, y: 28, width: 527.28, height: 260 }
  );
  const lines = layout.columns[0].entries[0].lines.join(' ');

  assert.equal(layout.columns[0].entries[0].time, '7:00');
  assert.equal(layout.columns[0].entries[0].truncated, false);
  assert.doesNotMatch(lines, /\.\.\./);
  assert.match(lines, /Readable Programme Title/);
});

test('wraps hyphenated and slash-separated programme text without ellipsizing short entries', () => {
  const title = 'World-Cup/Highlights Round-Up';
  const layout = layoutTvListingsForPdf(
    {
      channels: [
        {
          name: 'ITV1',
          programs: [{ startTime: '19:00', title }]
        }
      ]
    },
    { x: 34, y: 28, width: 527.28, height: 260 }
  );
  const lines = layout.columns[0].entries[0].lines;

  assert.equal(layout.columns[0].entries[0].time, '7:00');
  assert.equal(layout.columns[0].entries[0].truncated, false);
  assert.doesNotMatch(lines.join(' '), /\.\.\./);
  assert.match(lines.join(' '), /World-/);
  assert.match(lines.join(' '), /Cup\//);
});

test('keeps ordinary single-word TV titles beside the time', () => {
  const layout = layoutTvListingsForPdf(
    {
      channels: [
        {
          name: 'Channel 4',
          programs: [{ startTime: '21:00', title: 'Taskmaster' }]
        }
      ]
    },
    { x: 34, y: 28, width: 527.28, height: 260 }
  );
  const entry = layout.columns[0].entries[0];

  assert.equal(entry.time, '9:00');
  assert.equal(entry.stackedTitle, false);
  assert.equal(entry.lines[0], 'Taskmaster');
  assert.ok(entry.lineXOffsets[0] > 0);
});
