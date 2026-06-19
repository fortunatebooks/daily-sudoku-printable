const FREELY_TV_GUIDE_URL = 'https://www.freely.co.uk/api/tv-guide';
const FREELY_PROGRAM_URL = 'https://www.freely.co.uk/api/program';
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
  FREELY_PROGRAM_URL,
  FREELY_TV_GUIDE_URL,
  TV_CHANNELS,
  TV_FRESH_CACHE_MS,
  TV_LISTINGS_CACHE_KEY,
  TV_STALE_CACHE_MS,
  TV_TIME_ZONE,
  TV_WINDOW_END_HOUR,
  TV_WINDOW_START_HOUR
};

export function formatTvDisplayTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return '';
  }

  const hour = Number(match[1]);
  const minute = match[2];

  if (!Number.isFinite(hour)) {
    return '';
  }

  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute}`;
}

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
    const normalizedListings = normalizeFreelyTvGuide(rawListings, { dateIso: options.dateIso });
    const listings = await enrichEllipsizedFreelyTitles(normalizedListings, options);
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
      const normalizedEvents = events
        .map((event) => normalizeFreelyEvent(event))
        .filter(Boolean)
        .sort((left, right) => left.startMs - right.startMs)
        .map((program, index, allPrograms) => {
          const nextStartMs = allPrograms[index + 1]?.startMs;
          const durationEndMs = program.durationMs ? program.startMs + program.durationMs : null;
          let endMs = durationEndMs ?? nextStartMs ?? program.startMs + 60 * 60 * 1000;

          if (nextStartMs && nextStartMs > program.startMs && durationEndMs && durationEndMs > nextStartMs) {
            endMs = nextStartMs;
          }

          return {
            ...program,
            endMs
          };
        });
      const programs = normalizedEvents
        .filter((program) => program.startMs < windowEndMs && program.endMs > windowStartMs)
        .map(({ startMs, endMs, durationMs, programId, rawStartTime, duration, ...program }) => {
          const displayProgram =
            startMs < windowStartMs
              ? {
                  ...program,
                  startedBeforeWindow: true
                }
              : program;

          return attachFreelyDetail(displayProgram, { programId, rawStartTime, duration });
        });

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
        ? programs.map((program) => `${formatTvDisplayTime(program.startTime)} ${program.title}`).join('; ')
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
  const mainTitle = cleanTitle(event?.main_title ?? event?.title ?? event?.name);
  const secondaryTitle = cleanTitle(event?.secondary_title ?? event?.secondaryTitle ?? event?.subtitle);
  const title = titleWithUsefulSecondaryTitle(mainTitle, secondaryTitle);
  const rawStartTime = event?.start_time ?? event?.startTime ?? event?.start;
  const rawDuration = event?.duration ?? event?.durationMs;
  const startMs = parseGuideTime(rawStartTime);
  const durationMs = parseDurationMs(rawDuration);

  if (!title || startMs == null) {
    return null;
  }

  return {
    duration: rawDuration,
    programId: event?.program_id ?? event?.programId,
    rawStartTime,
    startMs,
    startTime: formatZonedTime(startMs),
    title,
    ...(durationMs ? { durationMs } : {})
  };
}

function attachFreelyDetail(program, detail) {
  if (!detail.programId || !detail.rawStartTime || !detail.duration) {
    return program;
  }

  Object.defineProperty(program, 'freelyDetail', {
    configurable: false,
    enumerable: false,
    value: detail,
    writable: false
  });

  return program;
}

async function enrichEllipsizedFreelyTitles(listings, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    return listings;
  }

  const tasks = [];

  for (const channel of listings.channels || []) {
    for (const program of channel.programs || []) {
      if (!canFetchFreelyProgramDetails(channel, program)) {
        continue;
      }

      tasks.push({ channel, program });
    }
  }

  if (tasks.length === 0) {
    return listings;
  }

  await Promise.all(
    tasks.map(async ({ channel, program }) => {
      try {
        const detail = await fetchFreelyProgramDetails(channel, program, options);
        const expanded = expandedTitleFromProgramDetail(program.title, detail);

        if (expanded) {
          program.title = expanded;
        }
      } catch {
        // TV detail enrichment is best-effort; keep the compact guide title on failure.
      }
    })
  );

  return listings;
}

function canFetchFreelyProgramDetails(channel, program) {
  const detail = program?.freelyDetail;

  return Boolean(
    channel?.serviceId &&
      detail?.programId &&
      detail?.rawStartTime &&
      detail?.duration &&
      (isEllipsizedTitle(program.title) || titleCanUseDetailSubtitle(program.title))
  );
}

async function fetchFreelyProgramDetails(channel, program, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  const url = new URL(options.programUrl ?? FREELY_PROGRAM_URL);
  const detail = program.freelyDetail;

  url.searchParams.set('sid', channel.serviceId);
  url.searchParams.set('nid', options.nid ?? FREELY_NID);
  url.searchParams.set('pid', detail.programId);
  url.searchParams.set('start_time', detail.rawStartTime);
  url.searchParams.set('duration', detail.duration);

  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        accept: 'application/json'
      },
      signal: controller?.signal
    });

    if (!response || !response.ok) {
      throw new Error(`TV programme detail request failed with status ${response?.status ?? 'unknown'}.`);
    }

    const body = await response.json();
    return body?.data?.programs?.[0] ?? null;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

function expandedTitleFromProgramDetail(title, detail) {
  return expandEllipsizedTitleFromProgramDetail(title, detail) || expandTitleFromProgramDetailSubtitle(title, detail);
}

function expandEllipsizedTitleFromProgramDetail(title, detail) {
  const cleanTitleValue = cleanTitle(title);

  if (!isEllipsizedTitle(cleanTitleValue)) {
    return null;
  }

  const detailTitle = cleanTitle(detail?.main_title ?? detail?.title ?? '');
  if (detailTitle && !isEllipsizedTitle(detailTitle) && detailTitle.length > cleanTitleValue.length) {
    return detailTitle;
  }

  const synopsis = synopsisText(detail?.synopsis);
  const prefix = cleanTitleValue.replace(/\s*\.{3}\s*$/, '').trim();
  const continuation = titleContinuationFromSynopsis(synopsis);
  const continuationWordCount = continuation ? continuation.split(/\s+/).length : 0;

  if (!prefix || !continuation || continuation.length > 45 || continuationWordCount > 7) {
    return null;
  }

  const expanded = cleanTitle(joinEllipsizedTitleParts(prefix, continuation));

  return expanded.length > prefix.length + 2 && !isEllipsizedTitle(expanded) ? expanded : null;
}

function expandTitleFromProgramDetailSubtitle(title, detail) {
  const cleanTitleValue = cleanTitle(title);

  if (!titleCanUseDetailSubtitle(cleanTitleValue)) {
    return null;
  }

  const secondaryTitle = cleanTitle(detail?.secondary_title ?? detail?.secondaryTitle ?? detail?.subtitle);
  const expanded = titleWithUsefulSecondaryTitle(cleanTitleValue, secondaryTitle);

  return expanded !== cleanTitleValue ? expanded : null;
}

function titleWithUsefulSecondaryTitle(title, secondaryTitle) {
  const cleanTitleValue = cleanTitle(title);
  const cleanSecondaryTitle = usefulSecondaryTitleForDisplay(cleanTitleValue, secondaryTitle);

  if (!cleanTitleValue || !cleanSecondaryTitle) {
    return cleanTitleValue;
  }

  return cleanTitle(`${cleanTitleValue}${cleanTitleValue.endsWith(':') ? ' ' : ': '}${cleanSecondaryTitle}`);
}

function usefulSecondaryTitleForDisplay(title, secondaryTitle) {
  const cleanTitleValue = cleanTitle(title);
  const cleanSecondaryTitle = meaningfulSecondaryTitle(secondaryTitle);

  if (!cleanSecondaryTitle) {
    return '';
  }

  const duplicateProbe = cleanTitle(
    cleanSecondaryTitle.replace(/^(?:Group Stage|Round of \d+|Quarter[- ]final|Semi[- ]final|Final|Live)\s*:\s*/i, '')
  );
  const lowerTitle = cleanTitleValue.toLowerCase();

  if (
    lowerTitle.includes(cleanSecondaryTitle.toLowerCase()) ||
    (duplicateProbe && lowerTitle.includes(duplicateProbe.toLowerCase()))
  ) {
    return '';
  }

  return cleanSecondaryTitle;
}

function meaningfulSecondaryTitle(secondaryTitle) {
  const cleanSecondaryTitle = cleanTitle(secondaryTitle);

  if (!cleanSecondaryTitle || isMechanicalSubtitle(cleanSecondaryTitle)) {
    return '';
  }

  const namedEpisodeMatch = cleanSecondaryTitle.match(/^Series \d+\s*:\s*\d+\.\s*(.+)$/i);
  if (namedEpisodeMatch) {
    const episodeTitle = cleanTitle(namedEpisodeMatch[1]);
    return isMechanicalSubtitle(episodeTitle) ? '' : episodeTitle;
  }

  const datedEpisodeMatch = cleanSecondaryTitle.match(/^20\d{2}\s*:\s*\d+\.\s*(.+)$/i);
  if (datedEpisodeMatch) {
    const episodeTitle = cleanTitle(datedEpisodeMatch[1]);
    return isMechanicalSubtitle(episodeTitle) ? '' : episodeTitle;
  }

  return cleanSecondaryTitle;
}

function isMechanicalSubtitle(value) {
  const text = cleanTitle(value);

  return (
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) ||
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?\s+\d{1,2}\s+[A-Z][a-z]{2,8}$/i.test(text) ||
    /^20\d{2}\s*:\s*Episode \d+$/i.test(text) ||
    /^Series \d+\s*:\s*Episode \d+$/i.test(text) ||
    /^Episode \d+$/i.test(text)
  );
}

function titleCanUseDetailSubtitle(title) {
  const cleanTitleValue = cleanTitle(title);

  return Boolean(cleanTitleValue && !cleanTitleValue.includes(':') && !isEllipsizedTitle(cleanTitleValue));
}

function titleContinuationFromSynopsis(synopsis) {
  const cleanSynopsis = cleanTitle(synopsis);
  const colonMatch = cleanSynopsis.match(/^\s*\.{3}\s*([^:]{2,45}):/);

  if (colonMatch) {
    return cleanTitle(colonMatch[1]);
  }

  const sentenceMatch = cleanSynopsis.match(/^\s*\.{3}\s*([^.!?]+)[.!?]/);
  return cleanTitle(sentenceMatch?.[1] || '');
}

function joinEllipsizedTitleParts(prefix, continuation) {
  if (/[&/:(['"]\s*$/.test(prefix) || /\b(?:a|an|and|at|by|for|from|in|of|on|or|the|to|with)\s*$/i.test(prefix)) {
    return `${prefix} ${continuation}`;
  }

  if (/\band\b/i.test(continuation) && !/^and\b/i.test(continuation)) {
    return `${prefix}, ${continuation}`;
  }

  return `${prefix} ${continuation}`;
}

function synopsisText(synopsis) {
  if (typeof synopsis === 'string') {
    return cleanTitle(synopsis);
  }

  return cleanTitle(synopsis?.medium ?? synopsis?.short ?? synopsis?.long ?? '');
}

function isEllipsizedTitle(title) {
  return /\.{3}\s*$/.test(String(title || '').trim());
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

function parseDurationMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 10000 ? value * 1000 : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch) {
    const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = isoMatch;
    const totalSeconds =
      Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    return totalSeconds > 0 ? totalSeconds * 1000 : null;
  }

  const clockMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const [, hours, minutes, seconds = '0'] = clockMatch;
    const totalSeconds = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    return totalSeconds > 0 ? totalSeconds * 1000 : null;
  }

  return null;
}

function cleanTitle(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/…/g, '...')
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
