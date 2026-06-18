import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FRESH_CACHE_MS,
  STALE_CACHE_MS,
  WEATHER_CACHE_KEY,
  buildWttrWeatherUrl,
  buildWeatherUrl,
  isRainyWeatherCode,
  isSunnyWeatherCode,
  loadServerWeather,
  loadWeather,
  moonPhaseName,
  normalizeOpenMeteoWeather,
  normalizeWttrWeather,
  weatherCodeIcon,
  weatherCodeLabel,
  weatherPdfLines
} from '../src/weather.js';

test('builds the fixed Christchurch Open-Meteo forecast URL', () => {
  const url = new URL(buildWeatherUrl());

  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '50.73583');
  assert.equal(url.searchParams.get('longitude'), '-1.78129');
  assert.equal(url.searchParams.get('forecast_days'), '4');
  assert.equal(url.searchParams.get('timezone'), 'Europe/London');
  assert.equal(url.searchParams.get('wind_speed_unit'), 'mph');
  assert.match(url.searchParams.get('daily'), /weather_code/);
  assert.match(url.searchParams.get('daily'), /precipitation_probability_max/);
  assert.match(url.searchParams.get('daily'), /wind_gusts_10m_max/);
  assert.match(url.searchParams.get('daily'), /sunrise/);
  assert.match(url.searchParams.get('hourly'), /precipitation_probability/);
  assert.match(url.searchParams.get('hourly'), /wind_gusts_10m/);
});

test('builds the fixed Christchurch wttr.in fallback URL', () => {
  const url = new URL(buildWttrWeatherUrl());

  assert.equal(url.origin + url.pathname, 'https://wttr.in/Christchurch,Dorset');
  assert.equal(url.searchParams.get('format'), 'j1');
});

test('maps Open-Meteo weather codes to labels and monochrome icon names', () => {
  assert.equal(weatherCodeLabel(0), 'Clear sky');
  assert.equal(weatherCodeLabel(63), 'Rain');
  assert.equal(weatherCodeLabel(999), 'Mixed conditions');
  assert.equal(weatherCodeIcon(0), 'sun');
  assert.equal(weatherCodeIcon(63), 'rain');
  assert.equal(weatherCodeIcon(95), 'storm');
  assert.equal(isSunnyWeatherCode(2), true);
  assert.equal(isSunnyWeatherCode(3), false);
  assert.equal(isRainyWeatherCode(80), true);
  assert.equal(isRainyWeatherCode(2), false);
});

test('normalizes weather into compact display and PDF lines', () => {
  const weather = normalizeOpenMeteoWeather(sampleOpenMeteo(), { dateIso: '2026-06-11' });

  assert.equal(weather.locationLabel, 'Christchurch, England');
  assert.equal(weather.attribution, 'Weather: Open-Meteo');
  assert.equal(weather.dateIso, '2026-06-11');
  assert.equal(weather.label, 'Partly cloudy');
  assert.equal(weather.icon, 'cloud');
  assert.equal(weather.temperatureLabel, 'High 18 C / Low 11 C');
  assert.equal(weather.precipitationProbabilityMax, 72);
  assert.equal(weather.precipitationSumMm, 1.4);
  assert.equal(Math.round(weather.sunshineHours), 5);
  assert.equal(weather.windGustMph, 18);
  assert.equal(weather.gardenSummary.rainSummary, 'Rain 7-8pm');
  assert.equal(weather.headline, 'Rain 7-8pm, dry otherwise');
  assert.deepEqual(
    weather.daypartForecasts.map((part) => `${part.shortLabel}: ${part.label}`),
    ['Morn: Sunny spells', 'Aft: Sunny spells', 'Eve: Rain 7-8pm']
  );
  assert.equal(weather.gardenSummary.windSummary, 'Breezy');
  assert.equal(weather.gardenSummary.wateringSummary, 'No watering needed');
  assert.deepEqual(weather.sunnyPeriods, ['morning', 'afternoon']);
  assert.deepEqual(weather.rainyPeriods, ['evening']);
  assert.equal(weather.sunLabel, 'Sunrise 04:50 / Sunset 21:18');
  assert.equal(weather.moonLabel, 'Moon: Waning crescent');

  assert.deepEqual(weatherPdfLines(weather), [
    'Christchurch weather',
    'Today: Rain 7-8pm, dry otherwise, 18/11 C, rain evening, sun 04:50-21:18, moon Waning crescent',
    'Fri 12 Jun: Rain 6-7am, dry otherwise, 17/10 C, rain morning, sun 04:50-21:19, moon Waning crescent',
    'Sat 13 Jun: Clear sky, 20/12 C, rain none expected, sun 04:49-21:19, moon New moon',
    'Sun 14 Jun: Overcast, 16/8 C, rain none expected, sun 04:49-21:20, moon New moon'
  ]);
});

test('normalizes wttr.in fallback weather into the same display model', () => {
  const weather = normalizeWttrWeather(sampleWttr(), { dateIso: '2026-06-11' });

  assert.equal(weather.locationLabel, 'Christchurch, England');
  assert.equal(weather.attribution, 'Weather: wttr.in');
  assert.equal(weather.dateIso, '2026-06-11');
  assert.equal(weather.label, 'Partly cloudy');
  assert.equal(weather.icon, 'cloud');
  assert.equal(weather.temperatureLabel, 'High 18 C / Low 11 C');
  assert.equal(weather.precipitationProbabilityMax, 65);
  assert.equal(weather.gardenSummary.rainSummary, 'Showers 6-7pm');
  assert.equal(weather.headline, 'Showers 6-7pm, dry otherwise');
  assert.deepEqual(weather.sunnyPeriods, ['morning']);
  assert.deepEqual(weather.rainyPeriods, ['evening']);
  assert.equal(weather.sunLabel, 'Sunrise 04:47 / Sunset 21:20');
  assert.equal(weather.moonLabel, 'Moon: Waning Crescent');
  assert.equal(weatherPdfLines(weather)[0], 'Christchurch weather');
});

test('selects requested forecast date as the first display day', () => {
  const weather = normalizeOpenMeteoWeather(sampleOpenMeteo(), { dateIso: '2026-06-13' });

  assert.equal(weather.dateIso, '2026-06-13');
  assert.equal(weather.days[0].dateIso, '2026-06-13');
  assert.equal(weather.days[0].label, 'Clear sky');
  assert.equal(weather.days.length, 2);
  assert.match(weatherPdfLines(weather)[1], /Today: Clear sky/);
});

test('computes basic local moon phases deterministically', () => {
  assert.equal(moonPhaseName('2000-01-06'), 'New moon');
  assert.equal(moonPhaseName('2000-01-14'), 'First quarter');
  assert.equal(moonPhaseName('2000-01-21'), 'Full moon');
  assert.equal(moonPhaseName('2026-06-11'), 'Waning crescent');
});

test('uses fresh cache and stale fallback without requiring API keys', async () => {
  const now = Date.UTC(2026, 5, 11, 10);
  const storage = memoryStorage();
  const cachedWeather = normalizeOpenMeteoWeather(sampleOpenMeteo(), { dateIso: '2026-06-11' });

  storage.setItem(
    WEATHER_CACHE_KEY,
    JSON.stringify({
      savedAt: now - FRESH_CACHE_MS + 1000,
      data: cachedWeather
    })
  );

  let fetchCalls = 0;
  const fresh = await loadWeather({
    dateIso: '2026-06-11',
    now,
    storage,
    fetchImpl: () => {
      fetchCalls += 1;
      throw new Error('should not fetch');
    }
  });

  assert.equal(fetchCalls, 0);
  assert.equal(fresh.label, 'Partly cloudy');

  storage.setItem(
    WEATHER_CACHE_KEY,
    JSON.stringify({
      savedAt: now - STALE_CACHE_MS + 1000,
      data: cachedWeather
    })
  );

  const stale = await loadWeather({
    dateIso: '2026-06-11',
    now,
    storage,
    fetchImpl: () => Promise.reject(new Error('network unavailable'))
  });

  assert.equal(stale.label, 'Partly cloudy');
  assert.equal(stale.days.length, 4);
  assert.equal(weatherPdfLines(stale).length, 5);

  storage.setItem(
    WEATHER_CACHE_KEY,
    JSON.stringify({
      savedAt: now - STALE_CACHE_MS - 1000,
      data: cachedWeather
    })
  );

  const expired = await loadWeather({
    dateIso: '2026-06-11',
    now,
    storage,
    fetchImpl: () => Promise.reject(new Error('network unavailable'))
  });

  assert.equal(expired, null);
});

test('server weather loader falls back from Open-Meteo to wttr.in', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const weather = await loadServerWeather({
    dateIso: '2026-06-11',
    storage,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ status: 502, body: 'Bad gateway', contentType: 'text/html' });
      }

      return jsonResponse({ body: sampleWttr() });
    }
  });

  assert.equal(calls, 2);
  assert.equal(weather.attribution, 'Weather: wttr.in');
  assert.equal(weather.label, 'Partly cloudy');
});

test('does not show forecast data for dates outside the forecast window', async () => {
  const now = Date.UTC(2026, 5, 11, 10);
  const storage = memoryStorage();
  const cachedWeather = normalizeOpenMeteoWeather(sampleOpenMeteo(), { dateIso: '2026-06-11' });

  storage.setItem(
    WEATHER_CACHE_KEY,
    JSON.stringify({
      savedAt: now,
      data: cachedWeather
    })
  );

  const outOfRange = await loadWeather({
    dateIso: '2026-06-01',
    now,
    storage,
    fetchImpl: () => Promise.reject(new Error('network unavailable'))
  });

  assert.equal(outOfRange, null);
});

function sampleOpenMeteo() {
  return {
    daily: {
      time: ['2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'],
      weather_code: [2, 61, 0, 3],
      temperature_2m_max: [18.4, 17.2, 19.6, 16.1],
      temperature_2m_min: [10.6, 9.8, 12.1, 8.4],
      apparent_temperature_max: [17.8, 16.8, 19.1, 15.4],
      precipitation_sum: [1.4, 3.2, 0, 0],
      precipitation_hours: [2, 4, 0, 0],
      precipitation_probability_max: [72, 84, 20, 25],
      sunshine_duration: [18000, 7200, 25200, 3600],
      wind_speed_10m_max: [12, 14, 8, 10],
      wind_gusts_10m_max: [18, 24, 12, 15],
      uv_index_max: [4.1, 3.2, 5.4, 2.1],
      et0_fao_evapotranspiration: [2.8, 1.9, 3.4, 1.2],
      sunrise: [
        '2026-06-11T04:50',
        '2026-06-12T04:50',
        '2026-06-13T04:49',
        '2026-06-14T04:49'
      ],
      sunset: [
        '2026-06-11T21:18',
        '2026-06-12T21:19',
        '2026-06-13T21:19',
        '2026-06-14T21:20'
      ]
    },
    hourly: {
      time: [
        '2026-06-11T06:00',
        '2026-06-11T07:00',
        '2026-06-11T08:00',
        '2026-06-11T12:00',
        '2026-06-11T13:00',
        '2026-06-11T14:00',
        '2026-06-11T18:00',
        '2026-06-11T19:00',
        '2026-06-11T20:00',
        '2026-06-12T06:00'
      ],
      weather_code: [0, 1, 2, 2, 3, 1, 3, 61, 3, 61],
      precipitation_probability: [5, 10, 20, 20, 30, 10, 35, 70, 30, 60],
      precipitation: [0, 0, 0, 0, 0, 0, 0, 1.2, 0, 0.8]
    }
  };
}

function sampleWttr() {
  return {
    weather: [
      {
        date: '2026-06-11',
        maxtempC: '18',
        mintempC: '11',
        astronomy: [
          {
            sunrise: '04:47 AM',
            sunset: '09:20 PM',
            moon_phase: 'Waning Crescent'
          }
        ],
        hourly: [
          wttrHour('600', 'Sunny', '113', '17', '0', '0', '88', '12'),
          wttrHour('1200', 'Partly cloudy', '116', '18', '0', '0', '35', '55'),
          wttrHour('1800', 'Light rain shower', '353', '15', '65', '0.4', '12', '80')
        ]
      },
      {
        date: '2026-06-12',
        maxtempC: '17',
        mintempC: '10',
        astronomy: [{ sunrise: '04:47 AM', sunset: '09:21 PM', moon_phase: 'Waning Crescent' }],
        hourly: [wttrHour('1200', 'Light rain', '296', '16', '55', '0.3', '10', '90')]
      }
    ]
  };
}

function wttrHour(time, description, code, tempC, chanceOfRain, precipMM, chanceOfSunshine, cloudCover) {
  return {
    time,
    weatherCode: code,
    tempC,
    chanceofrain: chanceOfRain,
    precipMM,
    chanceofsunshine: chanceOfSunshine,
    cloudcover: cloudCover,
    weatherDesc: [{ value: description }]
  };
}

function jsonResponse({ status = 200, body, contentType = 'application/json' }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : '';
      }
    },
    async json() {
      return body;
    }
  };
}

function memoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
