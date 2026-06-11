const FREELY_TV_GUIDE_URL = 'https://www.freely.co.uk/api/tv-guide';
const FREELY_NID = '64865';
const TV_LISTINGS_CACHE_KEY = 'daily-sudoku-tv-listings-v2';
const TV_FRESH_CACHE_MS = 4 * 60 * 60 * 1000;
const TV_STALE_CACHE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;
const TV_TIME_ZONE = 'Europe/London';
const TV_WINDOW_START_HOUR = 19;
const TV_WINDOW_END_HOUR = 23;

const TV_CHANNELS = [
  { serviceId: '37123', name: 'BBC One South' },
  { serviceId: '37184', name: 'BBC Two' },
  { serviceId: '37641', name: 'ITV1' },
  { serviceId: '37889', name: 'Channel 4' },
  { serviceId: '38145', name: '5' }
];

export {
  DEFAULT_TIMEOUT_MS as TV_DEFAULT_TIMEOUT_MS,
  FREELY_NID,
  FREELY_TV_GUIDE_URL,
  TV_CHANNELS,
  TV_FRESH_CACHE_MS,
  TV_LISTINGS_CACHE_KEY,
  TV_STALE_CACHE_MS,
  TV_TIME_ZONE,
  TV_WINDOW_END_HOUR,
  TV_WINDOW_START_HOUR
};

export async function loadTvListings(options = {}) {
  const now = options.now ?? Date.now();
  const storage = options.storage ?? safeLocalStorage();
  const cached = getCachedTvListings({
    dateIso: options.dateIso,
    now,
    storage,
    maxAgeMs: TV_FRESH_CACHE_MS
  });

  if (cached) {
    return cached;
  }

  try {
    const listings = await fetchServerTvListings(options);
    if (!listings?.unavailable) {
      writeTvListingsCache(listings, { now, storage });
    }
    return listings;
  } catch {
    return getCachedTvListings({
      dateIso: options.dateIso,
      now,
      storage,
      maxAgeMs: TV_STALE_CACHE_MS
    });
  }
}

export async function loadFreelyTvListings(options = {}) {
  const now = options.now ?? Date.now();
  const storage = options.storage ?? null;
  const cached = getCachedTvListings({
    dateIso: options.dateIso,
    now,
    storage,
    maxAgeMs: TV_FRESH_CACHE_MS
  });

  if (cached) {
    return cached;
  }

  try {
    const rawListings = await fetchFreelyTvGuide(options);
    const listings = normalizeFreelyTvGuide(rawListings, { dateIso: options.dateIso });
    writeTvListingsCache(listings, { now, storage });
    return listings;
  } catch {
    return getCachedTvListings({
      dateIso: options.dateIso,
      now,
      storage,
      maxAgeMs: TV_STALE_CACHE_MS
    });
  }
}

export async function fetchFreelyTvGuide(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('TV listings fetch is unavailable.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetchImpl(options.url ?? buildFreelyTvGuideUrl(options.dateIso), {
      headers: {
        accept: 'application/json'
      },
      signal: controller?.signal
    });

    if (!response || !response.ok) {
      throw new Error(`TV listings request failed with status ${response?.status ?? 'unknown'}.`);
    }

    return response.json();
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export function buildFreelyTvGuideUrl(dateIso = todayIsoInTimeZone()) {
  const params = new URLSearchParams({
    nid: FREELY_NID,
    start: String(startOfUtcDayUnix(dateIso))
  });

  return `${FREELY_TV_GUIDE_URL}?${params.toString()}`;
}

export function normalizeFreelyTvGuide(source, options = {}) {
  const dateIso = validIsoDate(options.dateIso) ? options.dateIso : todayIsoInTimeZone();
  const channels = extractFreelyChannels(source);
  const channelByServiceId = new Map(
    channels.map((channel) => [String(channel?.service_id ?? channel?.serviceId ?? ''), channel])
  );
  const windowStartMs = zonedTimeToUtcMs(dateIso, TV_WINDOW_START_HOUR, 0);
  const windowEndMs = zonedTimeToUtcMs(dateIso, TV_WINDOW_END_HOUR, 0);

  return {
    dateIso,
    sourceLabel: 'TV: Freely',
    timeZone: TV_TIME_ZONE,
    windowLabel: '19:00-23:00',
    channels: TV_CHANNELS.map((fixedChannel) => {
      const sourceChannel = channelByServiceId.get(fixedChannel.serviceId);
      const events = Array.isArray(sourceChannel?.events)
        ? sourceChannel.events
        : Array.isArray(sourceChannel?.programs)
          ? sourceChannel.programs
          : [];
      const programs = events
        .map((event) => normalizeFreelyEvent(event))
        .filter((program) => program && program.startMs >= windowStartMs && program.startMs <= windowEndMs)
        .sort((left, right) => left.startMs - right.startMs)
        .map(({ startMs, endMs, ...program }) => program);

      return {
        serviceId: fixedChannel.serviceId,
        name: fixedChannel.name,
        programs
      };
    })
  };
}

export function getCachedTvListings(options = {}) {
  const storage = options.storage ?? safeLocalStorage();
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? TV_STALE_CACHE_MS;
  const cached = readTvListingsCache(storage);

  if (!cached || now - cached.savedAt > maxAgeMs) {
    return null;
  }

  if (options.dateIso && cached.data?.dateIso !== options.dateIso) {
    return null;
  }

  return cached.data;
}

export function unavailableTvListings(dateIso) {
  return {
    unavailable: true,
    dateIso,
    sourceLabel: 'TV: Freely',
    timeZone: TV_TIME_ZONE,
    windowLabel: '19:00-23:00',
    channels: TV_CHANNELS.map((channel) => ({
      ...channel,
      programs: []
    }))
  };
}

export function tvListingsPdfLines(tvListings) {
  if (!tvListings) {
    return [];
  }

  if (tvListings.unavailable) {
    return ['Tonight on TV unavailable'];
  }

  const lines = [`Tonight on TV ${tvListings.windowLabel || '19:00-23:00'}`];

  for (const channel of tvListings.channels || []) {
    const programs = Array.isArray(channel.programs) ? channel.programs : [];
    const schedule =
      programs.length > 0
        ? programs.map((program) => `${program.startTime} ${program.title}`).join('; ')
        : 'No listings';
    lines.push(`${channel.name}: ${schedule}`);
  }

  return lines;
}

async function fetchServerTvListings(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('TV listings fetch is unavailable.');
  }

  const datePart = options.dateIso || 'today';
  const response = await fetchImpl(options.url ?? `/api/tv-listings/${datePart}`, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!response || !response.ok) {
    throw new Error(`TV listings endpoint failed with status ${response?.status ?? 'unknown'}.`);
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType && !contentType.includes('application/json')) {
    throw new Error('TV listings endpoint did not return JSON.');
  }

  return response.json();
}

function normalizeFreelyEvent(event) {
  const title = cleanTitle(event?.main_title ?? event?.title ?? event?.name);
  const startMs = parseGuideTime(event?.start_time ?? event?.startTime ?? event?.start);

  if (!title || startMs == null) {
    return null;
  }

  const durationMs = parseIsoDurationMs(event?.duration) ?? 30 * 60 * 1000;

  return {
    endMs: startMs + durationMs,
    startMs,
    startTime: formatZonedTime(startMs),
    title
  };
}

function extractFreelyChannels(source) {
  if (Array.isArray(source)) {
    return source;
  }

  const candidates = [
    source?.data?.programs,
    source?.data?.channels,
    source?.programs,
    source?.channels
  ];

  return candidates.find((candidate) => Array.isArray(candidate)) || [];
}

function parseGuideTime(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

function parseIsoDurationMs(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);

  if (!match) {
    return null;
  }

  const [, days, hours, minutes, seconds] = match;
  const totalSeconds =
    Number(days || 0) * 86400 +
    Number(hours || 0) * 3600 +
    Number(minutes || 0) * 60 +
    Number(seconds || 0);

  return totalSeconds > 0 ? totalSeconds * 1000 : null;
}

function cleanTitle(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function formatZonedTime(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: TV_TIME_ZONE
  }).formatToParts(new Date(ms));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

function zonedTimeToUtcMs(dateIso, hour, minute) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const targetMs = Date.UTC(year, month - 1, day, hour, minute);
  let utcMs = targetMs;

  for (let index = 0; index < 3; index += 1) {
    const zoned = zonedParts(utcMs);
    const zonedMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
    const diffMs = targetMs - zonedMs;
    if (diffMs === 0) {
      break;
    }
    utcMs += diffMs;
  }

  return utcMs;
}

function zonedParts(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: TV_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(new Date(ms));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function startOfUtcDayUnix(dateIso) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function todayIsoInTimeZone() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TV_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validIsoDate(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso || ''))) {
    return false;
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === dateIso;
}

function readTvListingsCache(storage) {
  try {
    const raw = storage?.getItem?.(TV_LISTINGS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeTvListingsCache(data, options = {}) {
  try {
    options.storage?.setItem?.(
      TV_LISTINGS_CACHE_KEY,
      JSON.stringify({
        savedAt: options.now ?? Date.now(),
        data
      })
    );
  } catch {
    // TV listings are best-effort; storage failures should not affect the puzzle.
  }
}

function safeLocalStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
