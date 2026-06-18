import { buildSudokuPdf, sudokuPdfFilename } from './pdf.js';
import { generateDailySudoku } from './sudoku.js';
import { getCachedWeather, loadWeather } from './weather.js';
import {
  formatTvDisplayTime,
  getCachedTvListings,
  loadTvListings,
  unavailableTvListings
} from './tv-listings.js';

const appState = {
  route: null,
  puzzle: null,
  cells: Array(81).fill(null),
  weather: null,
  weatherRouteKey: '',
  weatherPromise: null,
  tvListings: null,
  tvRouteKey: '',
  tvPromise: null,
  lastAutoPdfRoute: '',
  lastAutoPrintRoute: ''
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
  historyList: document.querySelector('#historyList'),
  weather: document.querySelector('#weatherWidget'),
  tvListings: document.querySelector('#tvListingsWidget')
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
    printCurrentPdf();
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
  renderWeather(null);
  renderTvListings(null);
  loadWeatherForRoute(route);
  loadTvListingsForRoute(route);
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
      const weather = await waitForWeatherForPdf(routeKey, route.dateIso);
      const tvListings = await waitForTvListingsForPdf(routeKey, route.dateIso);
      await downloadCurrentPdf({ weather, tvListings });
    }
  }

  if (route.mode === 'print' && appState.puzzle != null) {
    const routeKey = `${route.mode}:${route.dateIso}:${window.location.pathname}`;
    if (appState.lastAutoPrintRoute !== routeKey) {
      appState.lastAutoPrintRoute = routeKey;
      const weather = await waitForWeatherForPdf(routeKey, route.dateIso);
      const tvListings = await waitForTvListingsForPdf(routeKey, route.dateIso);
      await printCurrentPdf({ weather, tvListings });
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
  document.title = `Jenny's Sudoku - ${displayDate}`;
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

function loadWeatherForRoute(route) {
  const routeKey = `${route.mode}:${route.dateIso}:${window.location.pathname}`;
  appState.weatherRouteKey = routeKey;

  const cachedWeather = getCachedWeather({ dateIso: route.dateIso });
  if (cachedWeather) {
    appState.weather = cachedWeather;
    renderWeather(cachedWeather);
  }

  appState.weatherPromise = loadWeather({ dateIso: route.dateIso })
    .then((weather) => {
      if (appState.weatherRouteKey !== routeKey) {
        return null;
      }

      if (!weather || weather.unavailable) {
        renderWeatherUnavailable();
        return null;
      }

      appState.weather = weather;
      renderWeather(weather);
      return weather;
    })
    .catch(() => {
      if (appState.weatherRouteKey === routeKey) {
        renderWeatherUnavailable();
      }
      return null;
    });
}

function renderWeather(weather) {
  if (!elements.weather) {
    return;
  }

  elements.weather.replaceChildren();
  appState.weather = weather;

  if (!weather) {
    elements.weather.hidden = true;
    return;
  }

  if (weather.unavailable) {
    renderWeatherUnavailable();
    return;
  }

  elements.weather.hidden = false;
  const days = Array.isArray(weather.days) && weather.days.length > 0 ? weather.days.slice(0, 4) : [weather];

  const summary = document.createElement('div');
  summary.className = 'weather-summary';

  const icon = document.createElement('span');
  icon.className = 'weather-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = weatherIconSvg(weather.icon);

  const header = document.createElement('div');
  header.className = 'weather-header';

  const location = document.createElement('p');
  location.className = 'weather-location';
  location.textContent = weather.locationLabel || 'Christchurch, England';

  const label = document.createElement('p');
  label.className = 'weather-label';
  label.textContent = 'Today and next few days';

  header.append(location, label);
  summary.append(icon, header);

  const forecast = document.createElement('div');
  forecast.className = 'weather-days';

  days.forEach((day, index) => {
    const card = document.createElement('article');
    card.className = 'weather-day';

    const dayHeading = document.createElement('h3');
    dayHeading.textContent = index === 0 ? 'Today' : weatherDayLabel(day.dateIso);

    const dayIcon = document.createElement('span');
    dayIcon.className = 'weather-day-icon';
    dayIcon.setAttribute('aria-hidden', 'true');
    dayIcon.innerHTML = weatherIconSvg(day.icon);

    const dayLabel = document.createElement('p');
    dayLabel.className = 'weather-day-label';
    dayLabel.textContent = day.label || 'Forecast';

    const dayDetails = document.createElement('dl');
    dayDetails.className = 'weather-details';
    appendWeatherDetail(dayDetails, 'Temp', day.temperatureLabel);
    appendWeatherDetail(dayDetails, 'Sunny', stripDetailPrefix(day.sunnyPeriodsLabel));
    appendWeatherDetail(dayDetails, 'Rain', stripDetailPrefix(day.rainyPeriodsLabel));
    appendWeatherDetail(dayDetails, 'Sun', day.sunLabel);
    appendWeatherDetail(dayDetails, 'Moon', day.moonPhase);

    card.append(dayHeading, dayIcon, dayLabel, dayDetails);
    forecast.append(card);
  });

  const attribution = document.createElement('p');
  attribution.className = 'weather-attribution';
  attribution.textContent = weather.attribution || 'Weather: Open-Meteo';

  elements.weather.append(summary, forecast, attribution);
}

function renderWeatherUnavailable() {
  if (!elements.weather) {
    return;
  }

  appState.weather = null;
  elements.weather.replaceChildren();
  elements.weather.hidden = true;
}

function loadTvListingsForRoute(route) {
  const routeKey = `${route.mode}:${route.dateIso}:${window.location.pathname}`;
  appState.tvRouteKey = routeKey;

  const cachedListings = getCachedTvListings({ dateIso: route.dateIso });
  if (cachedListings) {
    appState.tvListings = cachedListings;
    renderTvListings(cachedListings);
  }

  appState.tvPromise = loadTvListings({ dateIso: route.dateIso })
    .then((tvListings) => {
      if (appState.tvRouteKey !== routeKey) {
        return null;
      }

      if (!tvListings || tvListings.unavailable) {
        renderTvListingsUnavailable(route.dateIso);
        return null;
      }

      appState.tvListings = tvListings;
      renderTvListings(tvListings);
      return tvListings;
    })
    .catch(() => {
      if (appState.tvRouteKey === routeKey) {
        renderTvListingsUnavailable(route.dateIso);
      }
      return null;
    });
}

function renderTvListings(tvListings) {
  if (!elements.tvListings) {
    return;
  }

  elements.tvListings.replaceChildren();
  appState.tvListings = tvListings;

  if (!tvListings) {
    elements.tvListings.hidden = true;
    return;
  }

  elements.tvListings.hidden = false;

  const header = document.createElement('div');
  header.className = 'tv-listings-header';

  const title = document.createElement('h2');
  title.textContent = 'Tonight on TV';

  const meta = document.createElement('p');
  meta.textContent = tvListings.windowLabel || '19:00-23:00';

  header.append(title, meta);

  const channels = document.createElement('div');
  channels.className = 'tv-listings-channels';

  (tvListings.channels || []).forEach((channel) => {
    const channelBlock = document.createElement('section');
    channelBlock.className = 'tv-listings-channel';

    const channelName = document.createElement('h3');
    channelName.textContent = channel.name;

    const list = document.createElement('ul');
    const programs = Array.isArray(channel.programs) ? channel.programs : [];

    if (programs.length === 0) {
      const item = document.createElement('li');
      item.className = 'tv-listing-empty';
      item.textContent = 'No listings';
      list.append(item);
    } else {
      programs.forEach((program) => {
        const item = document.createElement('li');
        const time = document.createElement('time');
        time.textContent = formatTvDisplayTime(program.startTime) || program.startTime;
        const name = document.createElement('span');
        name.textContent = program.title;
        item.append(time, name);
        list.append(item);
      });
    }

    channelBlock.append(channelName, list);
    channels.append(channelBlock);
  });

  elements.tvListings.append(header, channels);
}

function renderTvListingsUnavailable(dateIso) {
  if (!elements.tvListings) {
    return;
  }

  appState.tvListings = unavailableTvListings(dateIso);
  elements.tvListings.hidden = false;
  elements.tvListings.replaceChildren();

  const message = document.createElement('p');
  message.className = 'tv-listings-unavailable';
  message.textContent = 'Tonight\'s TV listings are unavailable right now.';

  elements.tvListings.append(message);
}

function appendWeatherDetail(parent, term, description) {
  if (!description) {
    return;
  }

  const item = document.createElement('div');
  item.className = 'weather-detail';

  const dt = document.createElement('dt');
  dt.textContent = term;

  const dd = document.createElement('dd');
  dd.textContent = description;

  item.append(dt, dd);
  parent.append(item);
}

function stripDetailPrefix(value) {
  return String(value || '').replace(/^[^:]+:\s*/, '');
}

function weatherIconSvg(icon) {
  const icons = {
    cloud:
      '<svg viewBox="0 0 48 48" focusable="false"><path d="M15 34h21a8 8 0 0 0 0-16 12 12 0 0 0-23-2 9 9 0 0 0 2 18Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
    fog:
      '<svg viewBox="0 0 48 48" focusable="false"><path d="M15 28h21a7 7 0 0 0 0-14 11 11 0 0 0-21-2 8 8 0 0 0 0 16Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M9 35h30M13 41h22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    rain:
      '<svg viewBox="0 0 48 48" focusable="false"><path d="M15 28h21a7 7 0 0 0 0-14 11 11 0 0 0-21-2 8 8 0 0 0 0 16Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M17 34v6M25 34v6M33 34v6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    snow:
      '<svg viewBox="0 0 48 48" focusable="false"><path d="M15 28h21a7 7 0 0 0 0-14 11 11 0 0 0-21-2 8 8 0 0 0 0 16Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 33v9M20 36l8 4M28 36l-8 4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    storm:
      '<svg viewBox="0 0 48 48" focusable="false"><path d="M15 28h21a7 7 0 0 0 0-14 11 11 0 0 0-21-2 8 8 0 0 0 0 16Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m25 31-5 9h7l-3 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun:
      '<svg viewBox="0 0 48 48" focusable="false"><circle cx="24" cy="24" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.25 4.25M33.25 33.25l4.25 4.25M37.5 10.5l-4.25 4.25M14.75 33.25l-4.25 4.25" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
  };

  return icons[icon] || icons.cloud;
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

function loadPuzzle(dateIso) {
  const puzzle = generateDailySudoku(dateIso);
  normalisePuzzle(puzzle);
  return puzzle;
}

async function waitForWeatherForPdf(routeKey, dateIso) {
  const cachedWeather = getCachedWeather({ dateIso });
  if (cachedWeather) {
    return cachedWeather;
  }

  const weatherPromise = appState.weatherPromise;
  if (!weatherPromise) {
    return null;
  }

  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 4200);
  });
  const weather = await Promise.race([weatherPromise, timeout]);

  if (appState.weatherRouteKey !== routeKey) {
    return null;
  }

  return weather;
}

async function waitForTvListingsForPdf(routeKey, dateIso) {
  const cachedListings = getCachedTvListings({ dateIso });
  if (cachedListings) {
    return cachedListings;
  }

  const tvPromise = appState.tvPromise;
  if (!tvPromise) {
    return null;
  }

  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve(null), 4200);
  });
  const tvListings = await Promise.race([tvPromise, timeout]);

  if (appState.tvRouteKey !== routeKey) {
    return null;
  }

  return tvListings;
}

async function downloadCurrentPdf(overrides = undefined) {
  try {
    const { blob, filename } = await createCurrentPdfBlob(overrides, 'Preparing PDF...');
    downloadBlob(blob, filename);
    setStatus('');
  } catch (error) {
    setStatus(errorMessage(error), true);
  }
}

async function printCurrentPdf(overrides = undefined) {
  try {
    const { blob, filename } = await createCurrentPdfBlob(overrides, 'Preparing print...');
    await printPdfBlob(blob, filename);
    setStatus('');
  } catch (error) {
    setStatus(errorMessage(error), true);
  }
}

async function createCurrentPdfBlob(overrides = undefined, statusMessage = 'Preparing PDF...') {
  const route = appState.route || resolveRoute(window.location.pathname);
  const dateIso = route.dateIso;
  const hasStructuredOverrides =
    overrides && typeof overrides === 'object' && ('weather' in overrides || 'tvListings' in overrides);
  const overrideWeather = hasStructuredOverrides ? overrides.weather : overrides;
  const overrideTvListings = hasStructuredOverrides ? overrides.tvListings : undefined;

  if (appState.puzzle == null) {
    throw new Error('The puzzle is not ready for PDF output yet.');
  }

  setStatus(statusMessage);
  const displayDate = formatDisplayDate.format(parseIsoDate(dateIso));
  const serverPdf = await fetchServerPdfBlob(dateIso).catch(() => null);

  if (serverPdf) {
    return serverPdf;
  }

  const payload = {
    date: dateIso,
    dateIso,
    isoDate: dateIso,
    displayDate,
    formattedDate: displayDate,
    title: "Jenny's Sudoku",
    puzzle: appState.puzzle,
    cells: appState.cells,
    weather:
      overrideWeather ||
      appState.weather ||
      getCachedWeather({ dateIso }) || {
        unavailable: true,
        locationLabel: 'Christchurch, England',
        attribution: ''
      },
    tvListings:
      overrideTvListings ||
      appState.tvListings ||
      getCachedTvListings({ dateIso }) ||
      unavailableTvListings(dateIso),
    filename: sudokuPdfFilename(dateIso)
  };
  const result = buildSudokuPdf(
    {
      ...appState.puzzle,
      displayDate: payload.displayDate,
      title: payload.title,
      weather: payload.weather,
      tvListings: payload.tvListings
    },
    payload.dateIso,
    {
    cells: payload.cells,
    displayDate: payload.displayDate,
    filename: payload.filename,
    title: payload.title,
    weather: payload.weather,
    tvListings: payload.tvListings
    }
  );

  return {
    blob: await pdfResultToBlob(result),
    filename: payload.filename
  };
}

async function fetchServerPdfBlob(dateIso) {
  if (window.location.protocol === 'file:') {
    return null;
  }

  const response = await fetch(`/pdf/${dateIso}?download=1`, {
    headers: {
      accept: 'application/pdf'
    }
  });

  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
    return null;
  }

  return {
    blob: await response.blob(),
    filename: sudokuPdfFilename(dateIso)
  };
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

async function pdfResultToBlob(result) {
  if (result instanceof Blob) {
    return result;
  }

  if (result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
    return new Blob([result], { type: 'application/pdf' });
  }

  if (typeof result === 'string') {
    const response = await fetch(result);

    if (!response.ok) {
      throw new Error('PDF output could not be loaded for printing.');
    }

    return response.blob();
  }

  if (result && typeof result === 'object') {
    const value = result.blob ?? result.file ?? result.data ?? result.bytes ?? result.url ?? result.href;
    if (value != null) {
      return pdfResultToBlob(value);
    }
  }

  throw new Error('PDF output was not generated.');
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

function printPdfBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    let settled = false;

    const cleanup = () => {
      frame.remove();
      URL.revokeObjectURL(url);
    };
    const finish = () => {
      if (!settled) {
        settled = true;
        window.setTimeout(cleanup, 60000);
        resolve();
      }
    };
    const fallbackToPdfTab = () => {
      const tab = window.open(url, '_blank', 'noopener');

      if (!tab) {
        cleanup();
        reject(new Error('The browser blocked the print PDF. Use Download PDF instead.'));
        return;
      }

      setStatus(`Opened ${filename} for printing.`);
      finish();
    };

    frame.title = `${filename} print preview`;
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.onload = () => {
      window.setTimeout(() => {
        try {
          const printWindow = frame.contentWindow;

          if (!printWindow || typeof printWindow.print !== 'function') {
            fallbackToPdfTab();
            return;
          }

          printWindow.focus();
          printWindow.print();
          finish();
        } catch {
          fallbackToPdfTab();
        }
      }, 250);
    };
    frame.onerror = () => {
      cleanup();
      reject(new Error('The print PDF could not be loaded.'));
    };

    document.body.append(frame);
    frame.src = url;
  });
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

function weatherDayLabel(dateIso) {
  if (!isValidIsoDate(dateIso)) {
    return 'Next day';
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(parseIsoDate(dateIso));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
