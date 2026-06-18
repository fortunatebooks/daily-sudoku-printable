import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { buildSudokuPdfBytes, sudokuPdfFilename } from '../src/pdf.js';
import {
  dateForRoute,
  generateDailySudoku,
  isValidDateString,
  todayInLondon
} from '../src/sudoku.js';
import { loadFreelyTvListings, TV_STALE_CACHE_MS, unavailableTvListings } from '../src/tv-listings.js';
import { loadServerWeather, STALE_CACHE_MS, WEATHER_CACHE_KEY } from '../src/weather.js';

const sourceRoot = path.join(process.cwd(), 'src');
const distRoot = path.join(process.cwd(), 'dist');
const port = Number(process.env.PORT || 3000);
const memoryWeatherStorage = createMemoryStorage();
const memoryTvListingsStorage = createMemoryStorage();

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8']
]);

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export function createRequestHandler(options = {}) {
  const root = path.resolve(options.root || distRoot);
  const fallbackRoot = path.resolve(options.fallbackRoot || sourceRoot);
  const weatherLoader = options.weatherLoader || loadServerWeather;
  const tvListingsLoader = options.tvListingsLoader || loadFreelyTvListings;

  return async function handleRequest(request, response) {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

      if (url.pathname === '/health') {
        return sendJson(response, 200, {
          ok: true,
          service: 'jennys-sudoku',
          today: todayInLondon()
        });
      }

      if (url.pathname.startsWith('/api/puzzle/')) {
        return sendPuzzleJson(response, url.pathname);
      }

      if (url.pathname.startsWith('/api/weather/')) {
        return sendWeatherJson(response, url.pathname, weatherLoader);
      }

      if (url.pathname.startsWith('/api/tv-listings/')) {
        return sendTvListingsJson(response, url.pathname, tvListingsLoader);
      }

      if (url.pathname === '/pdf/today' || /^\/pdf\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
        return sendPdf(response, url, { weatherLoader, tvListingsLoader });
      }

      return sendStaticApp(response, url, root, fallbackRoot);
    } catch (error) {
      response.writeHead(500, withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }));
      response.end(error instanceof Error ? error.message : 'Server error');
    }
  };
}

async function sendPuzzleJson(response, pathname) {
  const datePart = pathname.replace('/api/puzzle/', '');
  const date = datePart === 'today' ? todayInLondon() : datePart;

  if (!isValidDateString(date)) {
    return sendText(response, 404, 'Not found');
  }

  const puzzle = generateDailySudoku(date);

  return sendJson(response, 200, {
    date: puzzle.date,
    difficulty: puzzle.difficulty,
    puzzle: puzzle.puzzle,
    solution: puzzle.solution,
    puzzles: puzzle.puzzles,
    created_at: puzzle.created_at
  });
}

async function sendWeatherJson(response, pathname, weatherLoader) {
  const datePart = pathname.replace('/api/weather/', '');
  const date = datePart === 'today' ? todayInLondon() : datePart;

  if (!isValidDateString(date)) {
    return sendText(response, 404, 'Not found');
  }

  const weather =
    (await weatherLoader({
      dateIso: date,
      storage: memoryWeatherStorage,
      maxAgeMs: STALE_CACHE_MS,
      timeoutMs: 5000
    }).catch(() => null)) || unavailableWeather(date);

  return sendJson(response, 200, weather);
}

async function sendTvListingsJson(response, pathname, tvListingsLoader) {
  const datePart = pathname.replace('/api/tv-listings/', '');
  const date = datePart === 'today' ? todayInLondon() : datePart;

  if (!isValidDateString(date)) {
    return sendText(response, 404, 'Not found');
  }

  const listings =
    (await tvListingsLoader({
      dateIso: date,
      storage: memoryTvListingsStorage,
      maxAgeMs: TV_STALE_CACHE_MS,
      timeoutMs: 5000
    }).catch(() => null)) || unavailableTvListings(date);

  return sendJson(response, 200, listings);
}

async function sendPdf(response, url, loaders) {
  const date = dateForRoute(url.pathname);
  if (!date) {
    return sendText(response, 404, 'Not found');
  }

  const puzzle = generateDailySudoku(date);
  const [weather, tvListings] = await Promise.all([
    loaders.weatherLoader({
      dateIso: date,
      storage: memoryWeatherStorage,
      maxAgeMs: STALE_CACHE_MS,
      timeoutMs: 5000
    }).catch(() => null),
    loaders.tvListingsLoader({
      dateIso: date,
      storage: memoryTvListingsStorage,
      maxAgeMs: TV_STALE_CACHE_MS,
      timeoutMs: 5000
    }).catch(() => null)
  ]);
  const resolvedWeather = weather || unavailableWeather(date);
  const bytes = buildSudokuPdfBytes(puzzle, date, {
    title: "Jenny's Sudoku",
    weather: resolvedWeather,
    tvListings: tvListings || unavailableTvListings(date)
  });
  const filename = sudokuPdfFilename(date);
  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';

  response.writeHead(200, {
    ...securityHeaders,
    'content-type': 'application/pdf',
    'content-disposition': `${disposition}; filename="${filename}"`,
    'cache-control':
      url.pathname === '/pdf/today'
        ? 'no-store'
        : 'public, max-age=31536000, immutable',
    'content-length': String(bytes.byteLength)
  });
  response.end(bytes);
}

async function sendStaticApp(response, url, root, fallbackRoot) {
  const filePath = await resolveStaticPath(url.pathname, root, fallbackRoot);
  const body = await readFile(filePath);
  response.writeHead(200, {
    ...securityHeaders,
    'content-type': contentTypes.get(path.extname(filePath)) || 'application/octet-stream'
  });
  response.end(body);
}

async function resolveStaticPath(urlPath, root, fallbackRoot) {
  const decoded = safeDecodePath(urlPath);
  const clean = decoded === '/' ? '/index.html' : decoded;
  const candidate = safePath(root, clean);
  const candidateStat = await stat(candidate).catch(() => null);
  if (candidateStat && !candidateStat.isDirectory()) {
    return candidate;
  }

  const fallbackCandidate = safePath(fallbackRoot, clean);
  const fallbackStat = await stat(fallbackCandidate).catch(() => null);
  if (fallbackStat && !fallbackStat.isDirectory()) {
    return fallbackCandidate;
  }

  return (await stat(path.join(root, 'index.html')).catch(() => null))
    ? path.join(root, 'index.html')
    : path.join(fallbackRoot, 'index.html');
}

function safeDecodePath(urlPath) {
  try {
    return decodeURIComponent(urlPath);
  } catch {
    return '/';
  }
}

function safePath(root, urlPath) {
  const resolved = path.resolve(root, `.${urlPath}`);
  return isPathInside(root, resolved) ? resolved : path.join(root, 'index.html');
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

function sendText(response, status, body) {
  response.writeHead(status, withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }));
  response.end(body);
}

function withSecurityHeaders(headers) {
  return { ...securityHeaders, ...headers };
}

function unavailableWeather(dateIso) {
  return {
    unavailable: true,
    dateIso,
    locationLabel: 'Christchurch, England',
    attribution: ''
  };
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(createRequestHandler()).listen(port, () => {
    console.log(`Jenny's Sudoku server running at http://localhost:${port}`);
    console.log(`Weather cache key: ${WEATHER_CACHE_KEY}`);
  });
}
