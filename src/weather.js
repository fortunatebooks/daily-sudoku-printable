const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WTTR_FORECAST_URL = 'https://wttr.in/Christchurch,Dorset';
const CHRISTCHURCH_LATITUDE = 50.73583;
const CHRISTCHURCH_LONGITUDE = -1.78129;
const WEATHER_CACHE_KEY = 'daily-sudoku-weather-v1';
const FRESH_CACHE_MS = 3 * 60 * 60 * 1000;
const STALE_CACHE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 3500;
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const WEATHER_DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset'
];

const WEATHER_HOURLY_FIELDS = ['weather_code', 'precipitation_probability', 'precipitation'];

const PERIODS = [
  { name: 'morning', startHour: 6, endHour: 12 },
  { name: 'afternoon', startHour: 12, endHour: 18 },
  { name: 'evening', startHour: 18, endHour: 24 }
];

const WEATHER_LABELS = new Map([
  [0, 'Clear sky'],
  [1, 'Mainly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Rime fog'],
  [51, 'Light drizzle'],
  [53, 'Drizzle'],
  [55, 'Heavy drizzle'],
  [56, 'Freezing drizzle'],
  [57, 'Heavy freezing drizzle'],
  [61, 'Light rain'],
  [63, 'Rain'],
  [65, 'Heavy rain'],
  [66, 'Freezing rain'],
  [67, 'Heavy freezing rain'],
  [71, 'Light snow'],
  [73, 'Snow'],
  [75, 'Heavy snow'],
  [77, 'Snow grains'],
  [80, 'Light rain showers'],
  [81, 'Rain showers'],
  [82, 'Heavy rain showers'],
  [85, 'Snow showers'],
  [86, 'Heavy snow showers'],
  [95, 'Thunderstorm'],
  [96, 'Thunderstorm with hail'],
  [99, 'Severe thunderstorm with hail']
]);

export {
  CHRISTCHURCH_LATITUDE,
  CHRISTCHURCH_LONGITUDE,
  FRESH_CACHE_MS,
  OPEN_METEO_FORECAST_URL,
  STALE_CACHE_MS,
  WEATHER_CACHE_KEY,
  WTTR_FORECAST_URL
};

export function buildWeatherUrl() {
  const params = new URLSearchParams({
    latitude: String(CHRISTCHURCH_LATITUDE),
    longitude: String(CHRISTCHURCH_LONGITUDE),
    daily: WEATHER_DAILY_FIELDS.join(','),
    hourly: WEATHER_HOURLY_FIELDS.join(','),
    forecast_days: '4',
    timezone: 'Europe/London'
  });

  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

export function buildWttrWeatherUrl() {
  const params = new URLSearchParams({
    format: 'j1'
  });

  return `${WTTR_FORECAST_URL}?${params.toString()}`;
}

export async function loadWeather(options = {}) {
  const now = options.now ?? Date.now();
  const storage = options.storage ?? safeLocalStorage();
  const cached = getCachedWeather({ dateIso: options.dateIso, now, storage, maxAgeMs: FRESH_CACHE_MS });

  if (cached) {
    return cached;
  }

  if (shouldTryServerWeather(options)) {
    try {
      const weather = await fetchServerWeather(options);
      if (weather && !weather.unavailable) {
        writeWeatherCache(weather, { now, storage });
      }
      return weather;
    } catch {
      // Static previews do not have /api/weather, so continue to public sources.
    }
  }

  return loadWeatherFromPublicSources(options, { now, storage });
}

export async function loadServerWeather(options = {}) {
  const now = options.now ?? Date.now();
  const storage = options.storage ?? null;
  const cached = getCachedWeather({ dateIso: options.dateIso, now, storage, maxAgeMs: FRESH_CACHE_MS });

  if (cached) {
    return cached;
  }

  return loadWeatherFromPublicSources(options, { now, storage });
}

async function loadWeatherFromPublicSources(options, context) {
  const now = context.now ?? Date.now();
  const storage = context.storage ?? null;

  try {
    const rawWeather = await fetchOpenMeteoWeather(options);
    const weather = normalizeOpenMeteoWeather(rawWeather, { dateIso: options.dateIso });
    if (!weather) {
      throw new Error('Open-Meteo did not include the requested date.');
    }
    writeWeatherCache(weather, { now, storage });
    return weather;
  } catch {
    // Try the secondary public no-key source before using stale cache.
  }

  try {
    const rawWeather = await fetchWttrWeather(options);
    const weather = normalizeWttrWeather(rawWeather, { dateIso: options.dateIso });
    if (!weather) {
      throw new Error('wttr.in did not include the requested date.');
    }
    writeWeatherCache(weather, { now, storage });
    return weather;
  } catch {
    return getCachedWeather({ dateIso: options.dateIso, now, storage, maxAgeMs: STALE_CACHE_MS });
  }
}

async function fetchServerWeather(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Weather endpoint fetch is unavailable.');
  }

  const datePart = options.dateIso || 'today';
  const response = await fetchImpl(options.serverUrl ?? `/api/weather/${datePart}`, {
    headers: {
      accept: 'application/json'
    }
  });

  if (!response || !response.ok) {
    throw new Error(`Weather endpoint failed with status ${response?.status ?? 'unknown'}.`);
  }

  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType && !contentType.includes('application/json')) {
    throw new Error('Weather endpoint did not return JSON.');
  }

  return response.json();
}

export async function fetchOpenMeteoWeather(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Weather fetch is unavailable.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetchImpl(options.url ?? buildWeatherUrl(), {
      signal: controller?.signal
    });

    if (!response || !response.ok) {
      throw new Error(`Weather request failed with status ${response?.status ?? 'unknown'}.`);
    }

    return response.json();
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export async function fetchWttrWeather(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('wttr.in weather fetch is unavailable.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId =
    controller && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await fetchImpl(options.wttrUrl ?? buildWttrWeatherUrl(), {
      headers: {
        accept: 'application/json'
      },
      signal: controller?.signal
    });

    if (!response || !response.ok) {
      throw new Error(`wttr.in weather request failed with status ${response?.status ?? 'unknown'}.`);
    }

    return response.json();
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export function getCachedWeather(options = {}) {
  const storage = options.storage ?? safeLocalStorage();
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? STALE_CACHE_MS;
  const cached = readWeatherCache(storage);

  if (!cached || now - cached.savedAt > maxAgeMs) {
    return null;
  }

  return selectWeatherForecast(cached.data, options.dateIso);
}

export function normalizeOpenMeteoWeather(source, options = {}) {
  const daily = source?.daily;
  const hourly = source?.hourly;

  if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new TypeError('Open-Meteo daily weather data is missing.');
  }

  const days = daily.time.map((dateIso, index) => normalizeWeatherDay({ daily, hourly, index, dateIso }));
  return selectWeatherForecast({
    locationLabel: 'Christchurch, England',
    attribution: 'Weather: Open-Meteo',
    days
  }, options.dateIso);
}

export function normalizeWttrWeather(source, options = {}) {
  const sourceDays = Array.isArray(source?.weather) ? source.weather : [];

  if (sourceDays.length === 0) {
    throw new TypeError('wttr.in weather data is missing.');
  }

  const days = sourceDays.map((day) => normalizeWttrDay(day)).filter(Boolean);

  if (days.length === 0) {
    throw new TypeError('wttr.in weather days are missing.');
  }

  return selectWeatherForecast({
    locationLabel: 'Christchurch, England',
    attribution: 'Weather: wttr.in',
    days
  }, options.dateIso);
}

export function selectWeatherDay(weather, dateIso) {
  const days = Array.isArray(weather?.days) ? weather.days : [];

  if (days.length === 0) {
    return null;
  }

  if (!dateIso) {
    return days[0];
  }

  return days.find((day) => day.dateIso === dateIso) ?? null;
}

export function selectWeatherForecast(weather, dateIso) {
  const selectedDay = selectWeatherDay(weather, dateIso);

  if (!selectedDay) {
    return null;
  }

  return {
    locationLabel: weather.locationLabel || 'Christchurch, England',
    attribution: weather.attribution || 'Weather: Open-Meteo',
    days: Array.isArray(weather.days) ? weather.days : [selectedDay],
    selectedDateIso: selectedDay.dateIso,
    ...selectedDay
  };
}

export function weatherCodeLabel(code) {
  return WEATHER_LABELS.get(Number(code)) ?? 'Mixed conditions';
}

export function weatherCodeIcon(code) {
  const numericCode = Number(code);

  if (numericCode === 0 || numericCode === 1) {
    return 'sun';
  }

  if (numericCode === 2 || numericCode === 3) {
    return 'cloud';
  }

  if (numericCode === 45 || numericCode === 48) {
    return 'fog';
  }

  if (numericCode >= 71 && numericCode <= 86 && ![80, 81, 82].includes(numericCode)) {
    return 'snow';
  }

  if (numericCode >= 95) {
    return 'storm';
  }

  if (isRainyWeatherCode(numericCode)) {
    return 'rain';
  }

  return 'cloud';
}

export function isSunnyWeatherCode(code) {
  return [0, 1, 2].includes(Number(code));
}

export function isRainyWeatherCode(code) {
  return [
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99
  ].includes(Number(code));
}

export function moonPhaseName(dateIso) {
  const date = parseIsoDateNoon(dateIso);
  const age = positiveModulo((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000, SYNODIC_MONTH_DAYS);

  if (age < 1.84566) {
    return 'New moon';
  }
  if (age < 5.53699) {
    return 'Waxing crescent';
  }
  if (age < 9.22831) {
    return 'First quarter';
  }
  if (age < 12.91963) {
    return 'Waxing gibbous';
  }
  if (age < 16.61096) {
    return 'Full moon';
  }
  if (age < 20.30228) {
    return 'Waning gibbous';
  }
  if (age < 23.99361) {
    return 'Last quarter';
  }
  if (age < 27.68493) {
    return 'Waning crescent';
  }

  return 'New moon';
}

export function weatherPdfLines(weather) {
  if (!weather) {
    return [];
  }

  if (weather.unavailable) {
    return [];
  }

  if (Array.isArray(weather.days) && weather.days.length > 0) {
    return [
      'Christchurch weather',
      ...weather.days.slice(0, 4).map((day, index) => {
        const label = index === 0 ? 'Today' : shortDayLabel(day.dateIso);
        const rainy = stripDetailPrefix(day.rainyPeriodsLabel);
        return truncatePdfLine(`${label}: ${day.label}, ${shortTemperature(day)}, rain ${rainy}, sun ${shortSun(day)}, moon ${day.moonPhase}`);
      })
    ];
  }

  if (Array.isArray(weather.pdfLines)) {
    return weather.pdfLines;
  }

  const periodsLine = [weather.sunnyPeriodsLabel, weather.rainyPeriodsLabel].filter(Boolean).join('; ');
  const sunMoonLine = [weather.sunLabel, weather.moonLabel].filter(Boolean).join('; ');

  return [
    `${weather.locationLabel || 'Christchurch, England'}: ${weather.label || 'Weather forecast'}`,
    weather.temperatureLabel,
    periodsLine,
    sunMoonLine
  ].filter(Boolean);
}

function normalizeWeatherDay({ daily, hourly, index, dateIso }) {
  const code = numberOrNull(daily.weather_code?.[index]);
  const periods = summarizePeriods(hourly, dateIso);
  const highC = numberOrNull(daily.temperature_2m_max?.[index]);
  const lowC = numberOrNull(daily.temperature_2m_min?.[index]);
  const sunrise = formatLocalTime(daily.sunrise?.[index]);
  const sunset = formatLocalTime(daily.sunset?.[index]);
  const label = weatherCodeLabel(code);
  const sunnyPeriodsLabel = formatPeriods('Sunny periods', periods.sunny);
  const rainyPeriodsLabel = formatPeriods('Rain likely', periods.rainy);
  const moonPhase = moonPhaseName(dateIso);
  const day = {
    dateIso,
    label,
    icon: weatherCodeIcon(code),
    weatherCode: code,
    highC,
    lowC,
    temperatureLabel: `High ${formatTemperature(highC)} / Low ${formatTemperature(lowC)}`,
    sunnyPeriods: periods.sunny,
    rainyPeriods: periods.rainy,
    sunnyPeriodsLabel,
    rainyPeriodsLabel,
    sunrise,
    sunset,
    sunLabel: `Sunrise ${sunrise || '--:--'} / Sunset ${sunset || '--:--'}`,
    moonPhase,
    moonLabel: `Moon: ${moonPhase}`
  };

  return day;
}

function normalizeWttrDay(sourceDay) {
  const dateIso = sourceDay?.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso))) {
    return null;
  }

  const hourly = Array.isArray(sourceDay.hourly) ? sourceDay.hourly : [];
  const representativeHour = hourly.find((hour) => normalizeWttrHour(hour?.time) === 12) || hourly[0] || {};
  const label = cleanWeatherText(representativeHour.weatherDesc?.[0]?.value || sourceDay.weatherDesc?.[0]?.value) || 'Forecast';
  const periods = summarizeWttrPeriods(hourly);
  const highC = numberOrNull(sourceDay.maxtempC) ?? maxNumber(hourly.map((hour) => hour.tempC));
  const lowC = numberOrNull(sourceDay.mintempC) ?? minNumber(hourly.map((hour) => hour.tempC));
  const astronomy = Array.isArray(sourceDay.astronomy) ? sourceDay.astronomy[0] || {} : {};
  const sunrise = formatClockTime(astronomy.sunrise);
  const sunset = formatClockTime(astronomy.sunset);
  const moonPhase = normalizeMoonText(astronomy.moon_phase) || moonPhaseName(dateIso);
  const sunnyPeriodsLabel = formatPeriods('Sunny periods', periods.sunny);
  const rainyPeriodsLabel = formatPeriods('Rain likely', periods.rainy);
  const day = {
    dateIso,
    label,
    icon: weatherTextIcon(label),
    weatherCode: numberOrNull(representativeHour.weatherCode),
    highC,
    lowC,
    temperatureLabel: `High ${formatTemperature(highC)} / Low ${formatTemperature(lowC)}`,
    sunnyPeriods: periods.sunny,
    rainyPeriods: periods.rainy,
    sunnyPeriodsLabel,
    rainyPeriodsLabel,
    sunrise,
    sunset,
    sunLabel: `Sunrise ${sunrise || '--:--'} / Sunset ${sunset || '--:--'}`,
    moonPhase,
    moonLabel: `Moon: ${moonPhase}`
  };

  return day;
}

function summarizePeriods(hourly, dateIso) {
  if (!hourly || !Array.isArray(hourly.time)) {
    return { sunny: [], rainy: [] };
  }

  const sunny = [];
  const rainy = [];

  for (const period of PERIODS) {
    const entries = hourly.time
      .map((time, index) => ({ time, index, hour: hourFromLocalTime(time) }))
      .filter((entry) => entry.time?.startsWith(`${dateIso}T`) && entry.hour >= period.startHour && entry.hour < period.endHour);

    if (entries.length === 0) {
      continue;
    }

    const sunnyHours = entries.filter((entry) => isSunnyWeatherCode(hourly.weather_code?.[entry.index])).length;
    const rainyHours = entries.filter((entry) => isRainyHour(hourly, entry.index)).length;

    if (sunnyHours >= Math.max(1, Math.ceil(entries.length / 3))) {
      sunny.push(period.name);
    }

    if (rainyHours > 0) {
      rainy.push(period.name);
    }
  }

  return { sunny, rainy };
}

function summarizeWttrPeriods(hourly) {
  const sunny = [];
  const rainy = [];

  for (const period of PERIODS) {
    const entries = hourly
      .map((hour) => ({ hour, localHour: normalizeWttrHour(hour?.time) }))
      .filter((entry) => entry.localHour >= period.startHour && entry.localHour < period.endHour);

    if (entries.length === 0) {
      continue;
    }

    const sunnyHours = entries.filter(({ hour }) => isSunnyWttrHour(hour)).length;
    const rainyHours = entries.filter(({ hour }) => isRainyWttrHour(hour)).length;

    if (sunnyHours >= Math.max(1, Math.ceil(entries.length / 3))) {
      sunny.push(period.name);
    }

    if (rainyHours > 0) {
      rainy.push(period.name);
    }
  }

  return { sunny, rainy };
}

function isRainyHour(hourly, index) {
  const code = hourly.weather_code?.[index];
  const probability = numberOrNull(hourly.precipitation_probability?.[index]);
  const precipitation = numberOrNull(hourly.precipitation?.[index]);

  return isRainyWeatherCode(code) || (probability != null && probability >= 40) || (precipitation != null && precipitation >= 0.2);
}

function isSunnyWttrHour(hour) {
  const sunshine = numberOrNull(hour?.chanceofsunshine);
  const cloudCover = numberOrNull(hour?.cloudcover);
  const text = cleanWeatherText(hour?.weatherDesc?.[0]?.value).toLowerCase();

  return sunshine >= 50 || cloudCover <= 35 || text.includes('sunny') || text.includes('clear');
}

function isRainyWttrHour(hour) {
  const rainChance = numberOrNull(hour?.chanceofrain);
  const precipitation = numberOrNull(hour?.precipMM);
  const text = cleanWeatherText(hour?.weatherDesc?.[0]?.value).toLowerCase();

  return rainChance >= 40 || precipitation >= 0.2 || /rain|drizzle|shower|sleet|thunder/.test(text);
}

function formatPeriods(label, periods) {
  return `${label}: ${periods.length > 0 ? periods.join(', ') : 'none expected'}`;
}

function stripDetailPrefix(value) {
  return String(value || '').replace(/^[^:]+:\s*/, '');
}

function shortDayLabel(dateIso) {
  const date = parseIsoDateNoon(dateIso);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date);
}

function formatTemperature(value) {
  return value == null ? '-- C' : `${Math.round(value)} C`;
}

function shortTemperature(day) {
  const high = day.highC == null ? '--' : Math.round(day.highC);
  const low = day.lowC == null ? '--' : Math.round(day.lowC);
  return `${high}/${low} C`;
}

function shortSun(day) {
  return `${day.sunrise || '--:--'}-${day.sunset || '--:--'}`;
}

function weatherTextIcon(value) {
  const text = String(value || '').toLowerCase();

  if (/snow|sleet|ice/.test(text)) {
    return 'snow';
  }
  if (/thunder|storm/.test(text)) {
    return 'storm';
  }
  if (/rain|drizzle|shower/.test(text)) {
    return 'rain';
  }
  if (/fog|mist/.test(text)) {
    return 'fog';
  }
  if (/sun|clear/.test(text)) {
    return 'sun';
  }

  return 'cloud';
}

function truncatePdfLine(value, maxLength = 108) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatLocalTime(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const match = value.match(/T(\d{2}):(\d{2})/);

  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  return value.slice(0, 5);
}

function hourFromLocalTime(value) {
  if (typeof value !== 'string') {
    return -1;
  }

  const match = value.match(/T(\d{2})/);
  return match ? Number(match[1]) : -1;
}

function normalizeWttrHour(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return -1;
  }

  return Math.floor(number / 100);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function maxNumber(values) {
  const numbers = values.map(numberOrNull).filter((value) => value != null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function minNumber(values) {
  const numbers = values.map(numberOrNull).filter((value) => value != null);
  return numbers.length > 0 ? Math.min(...numbers) : null;
}

function cleanWeatherText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMoonText(value) {
  const text = cleanWeatherText(value);

  if (!text) {
    return '';
  }

  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function formatClockTime(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) {
    return value.slice(0, 5);
  }

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hour !== 12) {
    hour += 12;
  } else if (meridiem === 'AM' && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function shouldTryServerWeather(options) {
  return options.useServer !== false && !options.fetchImpl && !options.url && typeof window !== 'undefined';
}

function parseIsoDateNoon(dateIso) {
  if (typeof dateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [year, month, day] = dateIso.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  return new Date();
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function readWeatherCache(storage) {
  try {
    const raw = storage?.getItem?.(WEATHER_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeWeatherCache(data, options = {}) {
  try {
    options.storage?.setItem?.(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        savedAt: options.now ?? Date.now(),
        data
      })
    );
  } catch {
    // Weather is best-effort; storage failures should not affect the puzzle.
  }
}

function safeLocalStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
