import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSudokuPdfBytes,
  layoutTvChannelBandsForPdf,
  layoutTvListingsForPdf,
  sudokuPdfFilename
} from '../src/pdf.js';
import { buildSudokuPdfBytes as buildNodeSudokuPdfBytes } from '../src/pdf-node.js';
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
  assert.match(text, / 795 Tm \(Jenny's Sudoku\) Tj ET/);
  assert.match(text, / 768 Tm \(Thursday, 11 June 2026\) Tj ET/);
  assert.match(text, /Puzzle 1/);
  assert.match(text, /medium/);
  assert.match(text, /Driftwood Park Weather Forecast/);
  assert.match(text, /1\.9 w 36 524 m 36 728 l S/);
  assert.match(text, /0\.6 w 32 30 m 563 30 l S/);
  assert.match(text, /0\.6 w 32 282 m 563 282 l S/);
  assert.match(text, /Jenny's Sudoku/);
  assert.match(text, /Thursday, 11 June 2026/);
  assert.doesNotMatch(text, /Christchurch Weather/);
  assert.doesNotMatch(text, /Christchurch weather/);
  assert.match(text, /TODAY/);
  assert.match(text, /Partly cloudy/);
  assert.match(text, /High 18 \/ Low 11/);
  assert.match(text, /Rain likely evening/);
  assert.match(text, /Daylight/);
  assert.match(text, /04:50-21:18/);
  assert.match(text, /Fri/);
  assert.match(text, /Rain likely morning/);
  assert.doesNotMatch(text, /Weather: Open-Meteo/);
  assert.doesNotMatch(text, /Tonight on TV 19:00-23:00/);
  assert.doesNotMatch(text, /TV: Freely/);
  assert.match(text, /Tonight on TV - 7-11pm/);
  assert.match(text, /BBC One/);
  assert.match(text, /EastEnders/);
  assert.match(text, /\(8:00\) Tj/);
  assert.match(text, /Sort Your Life Out/);
  assert.match(text, /BBC Two/);
  assert.match(text, /Springwatch/);
  assert.doesNotMatch(text, /Notes:/);
  assert.doesNotMatch(text, /Finished in:/);
  assert.doesNotMatch(text, /Difficulty:/);
});

test('builds the two-puzzle graded print layout for current puzzles', () => {
  const puzzle = generateDailySudoku('2026-06-19');
  const bytes = buildSudokuPdfBytes(puzzle, puzzle.date, {
    weather: {
      days: [
        {
          dateIso: '2026-06-19',
          icon: 'sun',
          label: 'Sunny',
          highC: 20,
          lowC: 12,
          rainyPeriodsLabel: 'Rain likely: none expected',
          sunrise: '04:49',
          sunset: '21:19'
        }
      ]
    },
    tvListings: {
      channels: [
        { name: 'BBC One South', programs: [{ startTime: '19:00', title: 'EastEnders' }] },
        { name: 'BBC Two', programs: [] },
        { name: 'ITV1', programs: [] },
        { name: 'Channel 4', programs: [] },
        { name: '5', programs: [] }
      ]
    }
  });
  const text = new TextDecoder('ascii').decode(bytes);

  assert.match(text, /Puzzle 1/);
  assert.match(text, /Very Difficult/);
  assert.match(text, /Puzzle 2/);
  assert.match(text, /Fiendish/);
  assert.match(text, /Driftwood Park Weather Forecast/);
  assert.match(text, /1\.9 w 36 524 m 36 728 l S/);
  assert.match(text, /1\.9 w 36 296 m 36 500 l S/);
  assert.match(text, /0\.6 w 32 30 m 563 30 l S/);
  assert.match(text, /0\.6 w 32 282 m 563 282 l S/);
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
  assert.ok(layout.programmeFontSize >= 8.5);
  assert.ok(layout.channelFontSize > 0);
  assert.deepEqual(
    layout.columns.map((column) => column.heading),
    ['BBC One', 'BBC Two', 'ITV1', 'Channel 4', 'Channel 5']
  );
  assert.match(layout.columns[0].entries.flatMap((entry) => entry.lines).join(' '), /EastEnders/);
});

test('lays out TV listings as readable channel bands', () => {
  const layout = layoutTvChannelBandsForPdf(
    {
      channels: [
        {
          name: 'BBC One South',
          programs: [
            { startTime: '18:30', startedBeforeWindow: true, title: 'Antiques Road Trip' },
            { startTime: '19:30', title: 'EastEnders' },
            { startTime: '20:00', title: 'The Repair Shop' },
            { startTime: '21:00', title: 'Silent Witness' }
          ]
        },
        { name: 'BBC Two', programs: [{ startTime: '19:00', title: 'Gardeners World' }] },
        { name: 'ITV1', programs: [] },
        { name: 'Channel 4', programs: [] },
        { name: '5', programs: [] }
      ]
    },
    { x: 32, y: 30, width: 531, height: 252 }
  );

  assert.equal(layout.mode, 'channelBands');
  assert.equal(layout.rows.length, 5);
  assert.deepEqual(
    layout.rows.map((row) => row.heading),
    ['BBC One', 'BBC Two', 'ITV1', 'Channel 4', 'Channel 5']
  );
  const rowText = layout.rows[0].lines.flatMap((line) => line.segments.map((segment) => segment.text)).join(' ');
  assert.match(rowText, /6:30/);
  assert.doesNotMatch(rowText, /On now/);
  assert.ok(layout.rows[0].programmeWidth > 430);
});

test('builds the embedded-font server PDF without omitting TV listings', async () => {
  const puzzle = generateDailySudoku('2026-06-19');
  const layoutDebug = { tvRows: [] };
  const tvPrograms = [
    { startTime: '18:30', startedBeforeWindow: true, title: 'Antiques Road Trip' },
    { startTime: '19:30', title: 'EastEnders' },
    { startTime: '20:00', title: 'The Repair Shop' },
    { startTime: '20:30', title: 'A Very Long Programme Title That Needs Ellipsizing' },
    { startTime: '21:00', title: 'Silent Witness' },
    { startTime: '22:00', title: 'BBC News at Ten' }
  ];
  const bytes = await buildNodeSudokuPdfBytes(puzzle, puzzle.date, {
    layoutDebug,
    weather: {
      days: [
        {
          dateIso: '2026-06-19',
          icon: 'sun',
          label: 'Sunny',
          highC: 20,
          lowC: 12,
          sunrise: '04:49',
          sunset: '21:19',
          gardenSummary: {
            rainSummary: 'Mostly dry',
            windSummary: 'Light wind',
            wateringSummary: 'Water pots if soil is dry',
            bestGardenTime: 'Best outside time: morning'
          }
        }
      ]
    },
    tvListings: {
      channels: [
        { name: 'BBC One South', programs: tvPrograms },
        { name: 'BBC Two', programs: [] },
        { name: 'ITV1', programs: [] },
        { name: 'Channel 4', programs: [] },
        { name: '5', programs: [] }
      ]
    }
  });
  const firstRow = layoutDebug.tvRows[0];
  const fifthRow = layoutDebug.tvRows[4];

  assert.equal(new TextDecoder('ascii').decode(bytes.slice(0, 8)), '%PDF-1.3');
  assert.equal(layoutDebug.page.puzzleGridSize, 242);
  assert.equal(layoutDebug.page.mastheadRuleY, 64);
  assert.equal(layoutDebug.page.tvY, 586);
  assert.equal(layoutDebug.page.tvHeight, 228);
  assert.equal(firstRow.heading, 'BBC One');
  assert.equal(fifthRow.heading, 'Channel 5');
  assert.ok(firstRow.rowHeight < 45);
  assert.equal(firstRow.programmes.length, tvPrograms.length);
  assert.deepEqual(
    firstRow.programmes.map((programme) => programme.time),
    ['6:30', '7:30', '8:00', '8:30', '9:00', '10:00']
  );
  assert.equal(firstRow.programmes.some((programme) => programme.time === 'On now'), false);
  assert.equal(firstRow.programmes.some((programme) => /\+\d+ later/.test(programme.renderedTitle)), false);
  assert.equal(firstRow.programmes.some((programme) => programme.truncated), false);
  assert.ok(firstRow.minFontSize >= 8.5);
});

test('server TV layout uses spare line width before truncating programme titles', async () => {
  const puzzle = generateDailySudoku('2026-06-19');
  const layoutDebug = { tvRows: [] };

  await buildNodeSudokuPdfBytes(puzzle, puzzle.date, {
    layoutDebug,
    weather: {
      days: [
        {
          dateIso: '2026-06-19',
          icon: 'cloud',
          label: 'Cloudy',
          highC: 18,
          lowC: 10
        }
      ]
    },
    tvListings: {
      channels: [
        { name: 'BBC One South', programs: [] },
        { name: 'BBC Two', programs: [] },
        { name: 'ITV1', programs: [] },
        {
          name: 'Channel 4',
          programs: [
            { startTime: '19:00', title: 'Channel 4 News' },
            { startTime: '20:00', title: "George Clarke's Beautiful Builds" },
            { startTime: '21:00', title: '24 Hours in Police Custody' },
            { startTime: '22:00', title: 'The Accused: Beyond Reasonable Doubt' }
          ]
        },
        {
          name: '5',
          programs: [
            { startTime: '19:00', title: 'New: Build Your Dream Home in the Country' },
            { startTime: '20:00', title: 'Cornwall: A Year by the Sea' },
            { startTime: '21:00', title: 'New: The Hardacres' },
            { startTime: '22:00', title: 'Soham: The Murder of Holly & Jessica' }
          ]
        }
      ]
    }
  });

  const channel4 = layoutDebug.tvRows[3];
  const channel5 = layoutDebug.tvRows[4];
  const channel4Ten = channel4.programmes.find((programme) => programme.time === '10:00');
  const channel5Ten = channel5.programmes.find((programme) => programme.time === '10:00');

  assert.equal(channel4Ten.renderedTitle, 'The Accused: Beyond Reasonable Doubt');
  assert.equal(channel4Ten.truncated, false);
  assert.equal(channel5Ten.renderedTitle, 'Soham: The Murder of Holly & Jessica');
  assert.equal(channel5Ten.truncated, false);
  assert.deepEqual(channel5.lines, [
    ['7:00', '8:00'],
    ['9:00', '10:00']
  ]);
});

test('collapses dense TV channel bands to a later-count marker', () => {
  const programs = Array.from({ length: 12 }, (_, index) => ({
    startTime: `${String(19 + Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
    title: `Long Programme Title ${index + 1}`
  }));
  const layout = layoutTvChannelBandsForPdf(
    {
      channels: [
        { name: 'BBC One South', programs },
        { name: 'BBC Two', programs: [] },
        { name: 'ITV1', programs: [] },
        { name: 'Channel 4', programs: [] },
        { name: '5', programs: [] }
      ]
    },
    { x: 32, y: 30, width: 531, height: 252 }
  );
  const rowText = layout.rows[0].lines.flatMap((line) => line.segments.map((segment) => segment.text)).join(' ');

  assert.match(rowText, /\+\d+ later/);
  assert.doesNotMatch(rowText, /\b\d{1,2}\.\d{2}\s+\+\d+ later/);
  assert.equal(layout.rows[0].overflowCount > 0, true);
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
