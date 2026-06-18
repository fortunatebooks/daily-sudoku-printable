import {
  HARD_PUZZLE_START_DATE,
  countSolutions,
  generateDailySudoku,
  isValidSolution,
  puzzleMatchesSolution,
  todayInLondon
} from '../src/sudoku.js';

const options = parseArgs(process.argv.slice(2));
const rows = [];
const failures = [];
const warnings = [];

let dateIso = options.from;
for (let offset = 0; offset < options.days; offset += 1) {
  const daily = generateDailySudoku(dateIso);

  for (const puzzle of daily.puzzles) {
    const solutionCount = countSolutions(puzzle.puzzle, 2);
    const validSolution = isValidSolution(puzzle.solution);
    const matchesSolution = puzzleMatchesSolution(puzzle.puzzle, puzzle.solution);
    const row = {
      date: dateIso,
      dayOfWeek: dayOfWeek(dateIso),
      puzzleNumber: puzzle.number,
      requestedLabel: puzzle.requestedLabel,
      label: puzzle.label,
      measuredLabel: puzzle.measuredLabel,
      targetMet: puzzle.targetMet,
      fallback: puzzle.fallback,
      fallbackReason: puzzle.fallbackReason || '',
      clueCount: puzzle.clueCount,
      score: puzzle.grade?.score ?? '',
      hardTechniqueScore: puzzle.grade?.hardTechniqueScore ?? '',
      hardestTechnique: puzzle.grade?.hardestTechnique ?? '',
      hardestWeight: puzzle.grade?.hardestWeight ?? '',
      nonSingleSteps: puzzle.grade?.nonSingleSteps ?? '',
      stepCount: puzzle.grade?.stepCount ?? '',
      solvedWithoutGuessing: puzzle.grade?.solvedWithoutGuessing ?? '',
      singlesOnly: puzzle.grade?.singlesOnly ?? '',
      generationAttempts: puzzle.generationAttempts ?? '',
      solutionCount,
      validSolution,
      matchesSolution,
      puzzle: puzzle.puzzle,
      solution: puzzle.solution
    };
    rows.push(row);
    collectFailures({ failures, warnings, row, options });
  }

  dateIso = addDays(dateIso, 1);
}

if (options.format === 'json') {
  console.log(JSON.stringify(rows, null, 2));
} else if (options.format === 'csv') {
  console.log(toCsv(rows));
} else {
  printTable(rows);
}

if (options.ci && failures.length > 0) {
  console.error(`\nSudoku audit failed:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
}

if (warnings.length > 0) {
  console.error(`\nSudoku audit warnings:\n- ${warnings.join('\n- ')}`);
}

function collectFailures({ failures, warnings, row, options }) {
  if (row.solutionCount !== 1) {
    failures.push(`${row.date} puzzle ${row.puzzleNumber}: expected unique solution, got ${row.solutionCount}`);
  }
  if (!row.validSolution) {
    failures.push(`${row.date} puzzle ${row.puzzleNumber}: invalid solution`);
  }
  if (!row.matchesSolution) {
    failures.push(`${row.date} puzzle ${row.puzzleNumber}: puzzle does not match solution`);
  }
  if (row.date >= HARD_PUZZLE_START_DATE && row.singlesOnly === true) {
    failures.push(`${row.date} puzzle ${row.puzzleNumber}: hard puzzle is singles-only`);
  }
  if (row.date >= HARD_PUZZLE_START_DATE && row.fallback === true) {
    const message = `${row.date} puzzle ${row.puzzleNumber}: fallback (${row.fallbackReason})`;
    if (options.strictTargets) {
      failures.push(message);
    } else {
      warnings.push(message);
    }
  }
}

function parseArgs(args) {
  const options = {
    from: todayInLondon(),
    days: 30,
    format: 'table',
    ci: false,
    strictTargets: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--from') {
      options.from = args[index + 1];
      index += 1;
    } else if (arg === '--days') {
      options.days = Number(args[index + 1]);
      index += 1;
    } else if (arg === '--format') {
      options.format = args[index + 1];
      index += 1;
    } else if (arg === '--ci') {
      options.ci = true;
    } else if (arg === '--strict-targets') {
      options.strictTargets = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.from)) {
    throw new Error('--from must be YYYY-MM-DD.');
  }
  if (!Number.isInteger(options.days) || options.days < 1 || options.days > 366) {
    throw new Error('--days must be an integer from 1 to 366.');
  }
  if (!['table', 'csv', 'json'].includes(options.format)) {
    throw new Error('--format must be table, csv, or json.');
  }

  return options;
}

function printTable(rows) {
  for (const row of rows) {
    const fallback = row.fallback ? ` fallback: ${row.fallbackReason}` : '';
    console.log(
      `${row.date} ${row.dayOfWeek} #${row.puzzleNumber} ${row.requestedLabel} -> ${row.label}` +
        ` measured=${row.measuredLabel} clues=${row.clueCount} score=${row.score}` +
        ` hard=${row.hardTechniqueScore} hardest=${row.hardestTechnique || '-'} nonSingles=${row.nonSingleSteps}${fallback}`
    );
  }
}

function toCsv(rows) {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ].join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dayOfWeek(dateIso) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateIso}T12:00:00Z`)
  );
}

function addDays(dateIso, days) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
