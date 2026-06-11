import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { createRequestHandler } from '../scripts/server.mjs';

test('server returns raw PDFs for automation-friendly routes', async () => {
  const server = createServer(createRequestHandler({
    root: 'src',
    fallbackRoot: 'src',
    weatherLoader: async () => stubWeather(),
    tvListingsLoader: async () => stubTvListings('2026-06-11')
  }));
  await listen(server);

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${baseUrl}/pdf/2026-06-11`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder('ascii').decode(bytes.slice(0, 8));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition'), /filename="sudoku-2026-06-11\.pdf"/);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(text, '%PDF-1.4');
  } finally {
    await close(server);
  }
});

test('server keeps today PDFs fresh and rejects invalid dates cleanly', async () => {
  const server = createServer(createRequestHandler({
    root: 'src',
    fallbackRoot: 'src',
    weatherLoader: async () => stubWeather(),
    tvListingsLoader: async () => stubTvListings('2026-06-11')
  }));
  await listen(server);

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const todayPdf = await fetch(`${baseUrl}/pdf/today`);
    const invalidPuzzle = await fetch(`${baseUrl}/api/puzzle/not-a-date`);
    const invalidWeather = await fetch(`${baseUrl}/api/weather/2026-02-31`);
    const invalidTv = await fetch(`${baseUrl}/api/tv-listings/2026-02-31`);
    const invalidPdf = await fetch(`${baseUrl}/pdf/2026-02-31`);

    assert.equal(todayPdf.status, 200);
    assert.equal(todayPdf.headers.get('cache-control'), 'no-store');
    assert.equal(invalidPuzzle.status, 404);
    assert.equal(invalidWeather.status, 404);
    assert.equal(invalidTv.status, 404);
    assert.equal(invalidPdf.status, 404);
  } finally {
    await close(server);
  }
});

test('server exposes puzzle JSON and health checks', async () => {
  const server = createServer(createRequestHandler({
    root: 'src',
    fallbackRoot: 'src',
    weatherLoader: async () => stubWeather(),
    tvListingsLoader: async ({ dateIso }) => stubTvListings(dateIso)
  }));
  await listen(server);

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const healthResponse = await fetch(`${baseUrl}/health`);
    const puzzleResponse = await fetch(`${baseUrl}/api/puzzle/2026-06-11`);
    const weatherResponse = await fetch(`${baseUrl}/api/weather/2026-06-11`);
    const tvListingsResponse = await fetch(`${baseUrl}/api/tv-listings/2026-06-11`);
    const health = await healthResponse.json();
    const puzzle = await puzzleResponse.json();
    const weather = await weatherResponse.json();
    const tvListings = await tvListingsResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.match(healthResponse.headers.get('content-type'), /application\/json/);
    assert.equal(healthResponse.headers.get('cache-control'), 'no-store');
    assert.equal(puzzleResponse.status, 200);
    assert.match(puzzleResponse.headers.get('content-type'), /application\/json/);
    assert.equal(puzzleResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.ok, true);
    assert.equal(health.service, 'jennys-sudoku');
    assert.equal(puzzle.date, '2026-06-11');
    assert.equal(puzzle.puzzle.length, 81);
    assert.equal(puzzle.solution.length, 81);
    assert.equal(weather.label, 'Partly cloudy');
    assert.equal(weather.attribution, 'Weather: Open-Meteo');
    assert.equal(tvListings.dateIso, '2026-06-11');
    assert.equal(tvListings.channels[0].serviceId, '37123');
    assert.equal(tvListings.channels[0].programs[0].title, 'EastEnders');
  } finally {
    await close(server);
  }
});

test('server falls back to the SPA without serving files outside the app root', async () => {
  const server = createServer(createRequestHandler({
    root: 'src',
    fallbackRoot: 'src',
    weatherLoader: async () => stubWeather(),
    tvListingsLoader: async () => stubTvListings('2026-06-11')
  }));
  await listen(server);

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const routeResponse = await fetch(`${baseUrl}/puzzle/2026-06-11`);
    const traversalResponse = await fetch(`${baseUrl}/%2e%2e/package.json`);
    const malformedEncodingResponse = await fetch(`${baseUrl}/%E0%A4%A`);
    const routeText = await routeResponse.text();
    const traversalText = await traversalResponse.text();
    const malformedEncodingText = await malformedEncodingResponse.text();

    assert.equal(routeResponse.status, 200);
    assert.match(routeResponse.headers.get('content-type'), /text\/html/);
    assert.match(routeText, /Jenny's Sudoku/);
    assert.equal(traversalResponse.status, 200);
    assert.match(traversalResponse.headers.get('content-type'), /text\/html/);
    assert.match(traversalText, /Jenny's Sudoku/);
    assert.doesNotMatch(traversalText, /"name": "daily-sudoku-printable"/);
    assert.equal(malformedEncodingResponse.status, 200);
    assert.match(malformedEncodingResponse.headers.get('content-type'), /text\/html/);
    assert.match(malformedEncodingText, /Jenny's Sudoku/);
  } finally {
    await close(server);
  }
});

function stubWeather() {
  return {
    label: 'Partly cloudy',
    temperatureLabel: 'High 18 C / Low 11 C',
    sunnyPeriodsLabel: 'Sunny periods: morning',
    rainyPeriodsLabel: 'Rain likely: none expected',
    sunLabel: 'Sunrise 04:50 / Sunset 21:18',
    moonLabel: 'Moon: Waning crescent',
    attribution: 'Weather: Open-Meteo'
  };
}

function stubTvListings(dateIso) {
  return {
    dateIso,
    sourceLabel: 'TV: Freely',
    windowLabel: '19:00-23:00',
    channels: [
      {
        serviceId: '37123',
        name: 'BBC One South',
        programs: [{ startTime: '19:00', title: 'EastEnders' }]
      },
      { serviceId: '37184', name: 'BBC Two', programs: [] },
      { serviceId: '37641', name: 'ITV1', programs: [] },
      { serviceId: '37889', name: 'Channel 4', programs: [] },
      { serviceId: '38145', name: '5', programs: [] }
    ]
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
