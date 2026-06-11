const PUZZLE_EXPORTS = [
  'getPuzzleForDate',
  'puzzleForDate',
  'getPuzzle',
  'getDailyPuzzle',
  'generateDailySudoku',
  'generateSudokuForDate',
  'generateDailyPuzzle',
  'generatePuzzle',
  'buildPuzzle',
  'buildDailyPuzzle',
  'createPuzzle',
  'createDailyPuzzle',
  'makePuzzle',
  'makeDailyPuzzle',
  'getSudokuForDate',
  'generateSudoku',
  'generate',
  'create',
  'dailySudoku',
  'default'
];

const PDF_EXPORTS = [
  'downloadPdf',
  'downloadPDF',
  'downloadPuzzlePdf',
  'downloadPuzzlePDF',
  'downloadDailyPdf',
  'downloadDailyPDF',
  'downloadSudokuPdf',
  'downloadSudokuPDF',
  'buildSudokuPdf',
  'buildSudokuPDF',
  'buildSudokuPdfBytes',
  'buildSudokuPDFBytes',
  'generatePdf',
  'generatePDF',
  'generatePuzzlePdf',
  'generatePuzzlePDF',
  'createPdf',
  'createPDF',
  'buildPdf',
  'buildPDF',
  'buildPuzzlePdf',
  'buildPuzzlePDF',
  'savePdf',
  'savePDF',
  'exportPdf',
  'exportPDF',
  'default'
];

const appState = {
  route: null,
  puzzle: null,
  cells: Array(81).fill(null),
  lastAutoPdfRoute: ''
};

const elements = {
  dateText: document.querySelector('#dateText'),
  grid: document.querySelector('#sudokuGrid'),
  status: document.querySelector('#statusText'),
  previous: document.querySelector('[data-action="previous"]'),
  today: document.querySelector('[data-action="today"]'),
  history: document.querySelector('[data-action="history"]'),
  print: document.querySelector('[data-action="print"]'),
  pdf: document.querySelector('[data-action="pdf"]'),
  historyDialog: document.querySelector('#historyDialog'),
  historyList: document.querySelector('#historyList')
};

const formatDisplayDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

init();

function init() {
  elements.previous?.addEventListener('click', (event) => {
    event.preventDefault();
    navigate(`/puzzle/${addDays(appState.route?.dateIso || getLondonTodayIso(), -1)}`);
  });

  elements.today?.addEventListener('click', (event) => {
    event.preventDefault();
    navigate('/');
  });

  elements.history?.addEventListener('click', () => {
    navigate('/history');
  });

  elements.historyList?.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) {
      return;
    }

    event.preventDefault();
    navigate(link.getAttribute('href'));
  });

  elements.historyDialog?.addEventListener('close', () => {
    if (appState.route?.mode === 'history' && window.location.pathname === '/history') {
      navigate('/');
    }
  });

  elements.print?.addEventListener('click', () => {
    window.print();
  });

  elements.pdf?.addEventListener('click', () => {
    downloadCurrentPdf();
  });

  window.addEventListener('popstate', () => {
    renderRoute();
  });

  renderRoute();
}

async function renderRoute() {
  const route = resolveRoute(window.location.pathname);
  appState.route = route;
  document.body.dataset.routeMode = route.mode;

  if (route.shouldReplace) {
    window.history.replaceState({}, '', route.canonicalPath);
  }

  setStatus(route.message || '');
  renderDate(route.dateIso);
  renderEmptyGrid();
  renderHistory();
  syncHistoryDialog(route.mode === 'history');

  try {
    appState.puzzle = await loadPuzzle(route.dateIso);
    appState.cells = normalisePuzzle(appState.puzzle);
    renderGrid(appState.cells);
    setStatus('');
  } catch (error) {
    appState.puzzle = null;
    appState.cells = Array(81).fill(null);
    renderGrid(appState.cells);
    setStatus(errorMessage(error), true);
  }

  if (route.mode === 'pdf' && appState.puzzle != null) {
    const routeKey = `${route.mode}:${route.dateIso}:${window.location.pathname}`;
    if (appState.lastAutoPdfRoute !== routeKey) {
      appState.lastAutoPdfRoute = routeKey;
      await downloadCurrentPdf();
    }
  }
}

function resolveRoute(pathname) {
  const todayIso = getLondonTodayIso();
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (cleanPath === '/' || cleanPath === '/history') {
    return {
      mode: cleanPath === '/history' ? 'history' : 'puzzle',
      dateIso: todayIso,
      canonicalPath: cleanPath,
      shouldReplace: false
    };
  }

  const match = cleanPath.match(/^\/(puzzle|print|pdf)\/([^/]+)$/);
  if (!match) {
    return {
      mode: 'puzzle',
      dateIso: todayIso,
      canonicalPath: '/',
      shouldReplace: true,
      message: 'Showing today because the requested page was not found.'
    };
  }

  const [, mode, datePart] = match;
  const dateIso = datePart === 'today' ? todayIso : datePart;
  if (!isValidIsoDate(dateIso)) {
    return {
      mode: 'puzzle',
      dateIso: todayIso,
      canonicalPath: '/',
      shouldReplace: true,
      message: 'Showing today because the requested date was not valid.'
    };
  }

  return {
    mode,
    dateIso,
    canonicalPath: datePart === 'today' ? `/${mode}/today` : `/${mode}/${dateIso}`,
    shouldReplace: false
  };
}

function renderDate(dateIso) {
  const date = parseIsoDate(dateIso);
  const displayDate = formatDisplayDate.format(date);
  document.title = `Daily Sudoku - ${displayDate}`;
  elements.dateText.textContent = displayDate;
  elements.previous.href = `/puzzle/${addDays(dateIso, -1)}`;
  elements.today.href = '/';
}

function renderEmptyGrid() {
  renderGrid(Array(81).fill(null));
}

function renderGrid(cells) {
  const fragment = document.createDocumentFragment();

  cells.forEach((value, index) => {
    const cell = document.createElement('div');
    cell.className = 'sudoku-cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', cellLabel(index, value));
    if (value == null || value === '') {
      cell.classList.add('is-empty');
      cell.textContent = '';
    } else {
      cell.textContent = String(value);
    }
    fragment.append(cell);
  });

  elements.grid.replaceChildren(fragment);
}

function renderHistory() {
  const currentDate = appState.route?.dateIso || getLondonTodayIso();
  const dates = Array.from({ length: 14 }, (_, index) => addDays(getLondonTodayIso(), -index));
  const fragment = document.createDocumentFragment();

  dates.forEach((dateIso) => {
    const link = document.createElement('a');
    link.className = 'history-date';
    link.href = `/puzzle/${dateIso}`;
    link.textContent = formatDisplayDate.format(parseIsoDate(dateIso));
    if (dateIso === currentDate) {
      link.setAttribute('aria-current', 'date');
    }
    fragment.append(link);
  });

  elements.historyList.replaceChildren(fragment);
}

function syncHistoryDialog(shouldOpen) {
  if (!elements.historyDialog) {
    return;
  }

  if (shouldOpen && !elements.historyDialog.open) {
    if (typeof elements.historyDialog.showModal === 'function') {
      elements.historyDialog.showModal();
    } else {
      elements.historyDialog.setAttribute('open', '');
    }
  } else if (!shouldOpen && elements.historyDialog.open) {
    elements.historyDialog.close();
  }
}

async function loadPuzzle(dateIso) {
  const sudokuModule = await import('./sudoku.js');
  const generator = findExport(sudokuModule, PUZZLE_EXPORTS);

  if (!generator) {
    throw new Error('No compatible puzzle generator was exported from sudoku.js.');
  }

  return callPuzzleGenerator(generator, dateIso);
}

async function callPuzzleGenerator(generator, dateIso) {
  const payload = {
    date: dateIso,
    dateIso,
    isoDate: dateIso,
    dateObject: parseIsoDate(dateIso),
    timeZone: 'Europe/London'
  };
  const attempts =
    generator.length <= 1
      ? [() => generator(dateIso), () => generator(payload)]
      : [() => generator(dateIso, payload), () => generator(payload)];
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      normalisePuzzle(result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('The puzzle generator returned an invalid grid.');
}

async function downloadCurrentPdf() {
  const route = appState.route || resolveRoute(window.location.pathname);
  const dateIso = route.dateIso;

  try {
    if (appState.puzzle == null) {
      throw new Error('The puzzle is not ready for PDF download yet.');
    }

    setStatus('Preparing PDF...');
    const pdfModule = await import('./pdf.js');
    const pdfExport = findExportEntry(pdfModule, PDF_EXPORTS);
    const createPdf = pdfExport?.fn;

    if (!createPdf) {
      throw new Error('No compatible PDF export was found in pdf.js.');
    }

    const displayDate = formatDisplayDate.format(parseIsoDate(dateIso));
    const payload = {
      date: dateIso,
      dateIso,
      isoDate: dateIso,
      displayDate,
      formattedDate: displayDate,
      title: 'Daily Sudoku',
      puzzle: appState.puzzle,
      cells: appState.cells,
      filename: resolvePdfFilename(pdfModule, dateIso)
    };
    const result = await callPdfExporter(createPdf, payload, pdfExport.name);

    if (result != null) {
      savePdfResult(result, payload.filename);
    }

    setStatus('');
  } catch (error) {
    setStatus(errorMessage(error), true);
  }
}

async function callPdfExporter(createPdf, payload, exportName) {
  const options = {
    cells: payload.cells,
    displayDate: payload.displayDate,
    filename: payload.filename,
    title: payload.title
  };
  const name = `${exportName || ''} ${createPdf.name || ''}`.toLowerCase();
  const puzzleFirst = () => createPdf(payload.puzzle, payload.dateIso, options);
  const dateFirst = () => createPdf(payload.dateIso, payload.puzzle, options);
  const objectOnly = () => createPdf(payload);
  const puzzleWithOptions = () => createPdf(payload.puzzle, options);
  const attempts = [];

  if (name.includes('buildsudokupdf') || name.includes('buildsudokupdfbytes')) {
    attempts.push(puzzleFirst, objectOnly, dateFirst);
  } else if (createPdf.length <= 1) {
    attempts.push(objectOnly, puzzleFirst, dateFirst);
  } else if (name.includes('build') || name.includes('create') || name.includes('generate')) {
    attempts.push(puzzleFirst, dateFirst, objectOnly, puzzleWithOptions);
  } else {
    attempts.push(dateFirst, objectOnly, puzzleFirst, puzzleWithOptions);
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('PDF export failed.');
}

function findExport(moduleObject, names) {
  return findExportEntry(moduleObject, names)?.fn || null;
}

function findExportEntry(moduleObject, names) {
  for (const name of names) {
    const value = moduleObject[name];
    if (typeof value === 'function') {
      return { fn: value, name };
    }

    if (value && typeof value === 'object') {
      const nested = findExportEntry(value, names.filter((candidate) => candidate !== 'default'));
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function normalisePuzzle(source) {
  const grid = extractGrid(source);
  const flattened = flattenGrid(grid);
  const cells = flattened.map(cellToDisplayValue).slice(0, 81);

  if (cells.length !== 81) {
    throw new Error('Expected a Sudoku puzzle with 81 cells.');
  }

  return cells;
}

function flattenGrid(grid) {
  if (typeof grid === 'string') {
    return stringToCells(grid);
  }

  if (!Array.isArray(grid)) {
    return [];
  }

  return grid.flatMap((item) => {
    if (Array.isArray(item)) {
      return flattenGrid(item);
    }

    if (typeof item === 'string' && item.replace(/\s/g, '').length > 1) {
      return stringToCells(item);
    }

    return [item];
  });
}

function extractGrid(source) {
  if (source == null) {
    return [];
  }

  if (typeof source === 'string' || Array.isArray(source)) {
    return source;
  }

  if (typeof source === 'object') {
    const gridKeys = ['puzzle', 'givens', 'clues', 'grid', 'cells', 'board', 'values'];
    for (const key of gridKeys) {
      if (key in source) {
        return source[key];
      }
    }
  }

  return source;
}

function stringToCells(value) {
  if (typeof value !== 'string') {
    return [];
  }

  return value.replace(/\s/g, '').split('');
}

function cellToDisplayValue(cell) {
  if (cell == null || cell === 0 || cell === '.' || cell === '-') {
    return null;
  }

  if (typeof cell === 'number') {
    return Number.isInteger(cell) && cell >= 1 && cell <= 9 ? cell : null;
  }

  if (typeof cell === 'string') {
    const trimmed = cell.trim();
    if (!trimmed || trimmed === '0' || trimmed === '.' || trimmed === '-') {
      return null;
    }

    return /^[1-9]$/.test(trimmed) ? trimmed : null;
  }

  if (typeof cell === 'object') {
    if ('given' in cell && cell.given === false) {
      return null;
    }

    const value = cell.value ?? cell.digit ?? cell.number ?? cell.given ?? cell.clue;
    return cellToDisplayValue(value);
  }

  return null;
}

function savePdfResult(result, filename) {
  if (result instanceof Blob) {
    downloadBlob(result, filename);
    return;
  }

  if (result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
    const blob = new Blob([result], { type: 'application/pdf' });
    downloadBlob(blob, filename);
    return;
  }

  if (typeof result === 'string') {
    const link = document.createElement('a');
    link.href = result;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }

  if (typeof result === 'object') {
    const value = result.blob ?? result.file ?? result.data ?? result.bytes ?? result.url ?? result.href;
    const downloadName = result.filename || result.name || filename;
    if (value != null) {
      savePdfResult(value, downloadName);
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function navigate(path) {
  window.history.pushState({}, '', path);
  renderRoute();
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', Boolean(isError));
}

function cellLabel(index, value) {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const contents = value == null || value === '' ? 'empty' : value;
  return `Row ${row}, column ${column}, ${contents}`;
}

function pdfFilename(dateIso) {
  return `sudoku-${dateIso}.pdf`;
}

function resolvePdfFilename(pdfModule, dateIso) {
  if (typeof pdfModule.sudokuPdfFilename === 'function') {
    try {
      return pdfModule.sudokuPdfFilename(dateIso);
    } catch {
      return pdfFilename(dateIso);
    }
  }

  return pdfFilename(dateIso);
}

function getLondonTodayIso() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseIsoDate(dateIso) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isValidIsoDate(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return false;
  }

  const date = parseIsoDate(dateIso);
  return date.toISOString().slice(0, 10) === dateIso;
}

function addDays(dateIso, days) {
  const date = parseIsoDate(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
