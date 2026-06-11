import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFreelyProxyUrl,
  buildFreelyTvGuideUrl,
  formatTvDisplayTime,
  getCachedTvListings,
  loadFreelyTvListings,
  loadTvListings,
  normalizeFreelyTvGuide,
  TV_CHANNELS,
  TV_LISTINGS_CACHE_KEY,
  tvListingsPdfLines
} from '../src/tv-listings.js';

test('normalizes fixed Freely channels into the London evening window', () => {
  const listings = normalizeFreelyTvGuide(sampleFreelyGuide(), { dateIso: '2026-06-11' });
  const bbcOne = listings.channels.find((channel) => channel.serviceId === '37123');
  const bbcTwo = listings.channels.find((channel) => channel.serviceId === '37184');

  assert.deepEqual(
    listings.channels.map((channel) => [channel.serviceId, channel.name]),
    TV_CHANNELS.map((channel) => [channel.serviceId, channel.name])
  );
  assert.equal(listings.windowLabel, '19:00-23:00');
  assert.deepEqual(bbcOne.programs, [
    { startTime: '19:00', title: 'EastEnders' },
    { startTime: '20:00', title: 'Sort Your Life Out' },
    { startTime: '22:30', title: 'BBC South Today' },
    { startTime: '23:00', title: 'Question Time' }
  ]);
  assert.deepEqual(bbcTwo.programs, [
    { startTime: '19:55', title: 'The Secret Genius of Modern Life' }
  ]);
});

test('builds the Freely URL with fixed personal-use nid and UTC day start', () => {
  const url = buildFreelyTvGuideUrl('2026-06-11');

  assert.equal(url, 'https://www.freely.co.uk/api/tv-guide?nid=64865&start=1781136000');
  assert.equal(buildFreelyProxyUrl('2026-06-11'), '/api/freely-tv-guide?nid=64865&start=1781136000');
});

test('browser loader falls back to here.now Freely proxy when server API returns SPA HTML', async () => {
  const storage = createMemoryStorage();
  const requestedUrls = [];
  const listings = await loadTvListings({
    dateIso: '2026-06-11',
    storage,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (String(url).startsWith('/api/tv-listings/')) {
        return responseStub({
          body: '<!doctype html><title>Jenny</title>',
          contentType: 'text/html; charset=utf-8'
        });
      }

      return responseStub({
        body: sampleFreelyGuide(),
        contentType: 'application/json'
      });
    }
  });

  assert.deepEqual(requestedUrls, [
    '/api/tv-listings/2026-06-11',
    '/api/freely-tv-guide?nid=64865&start=1781136000'
  ]);
  assert.equal(listings.channels[0].programs[0].title, 'EastEnders');
});

test('falls back to stale cached TV listings when Freely fetch fails', async () => {
  const storage = createMemoryStorage();
  const cachedListings = normalizeFreelyTvGuide(sampleFreelyGuide(), { dateIso: '2026-06-11' });
  const now = Date.UTC(2026, 5, 11, 12);
  storage.setItem(
    TV_LISTINGS_CACHE_KEY,
    JSON.stringify({
      savedAt: now - 8 * 60 * 60 * 1000,
      data: cachedListings
    })
  );

  const listings = await loadFreelyTvListings({
    dateIso: '2026-06-11',
    fetchImpl: async () => {
      throw new Error('offline');
    },
    now,
    storage
  });

  assert.equal(listings.dateIso, '2026-06-11');
  assert.equal(getCachedTvListings({ dateIso: '2026-06-11', now, storage })?.channels.length, 5);
});

test('formats compact PDF lines without descriptions or artwork', () => {
  const listings = normalizeFreelyTvGuide(sampleFreelyGuide(), { dateIso: '2026-06-11' });
  const lines = tvListingsPdfLines(listings);

  assert.match(lines[0], /Tonight on TV 19:00-23:00/);
  assert.match(lines.join('\n'), /BBC One South: 7:00 EastEnders/);
  assert.doesNotMatch(lines.join('\n'), /A long programme description/);
  assert.doesNotMatch(lines.join('\n'), /image/);
});

test('formats visible TV listing times as 12-hour labels without pm', () => {
  assert.equal(formatTvDisplayTime('19:00'), '7:00');
  assert.equal(formatTvDisplayTime('23:00'), '11:00');
  assert.equal(formatTvDisplayTime('00:30'), '12:30');
});

test('removes feed-provided ellipsis from short programme titles', () => {
  const guide = sampleFreelyGuide();
  guide.data.programs.find((channel) => channel.service_id === '37123').events.push({
    main_title: 'New: Build Your Dream Home in...',
    start_time: '2026-06-11T20:30:00+0000',
    duration: 'PT30M'
  });

  const listings = normalizeFreelyTvGuide(guide, { dateIso: '2026-06-11' });
  const title = listings.channels[0].programs.find((program) => program.startTime === '21:30')?.title;

  assert.equal(title, 'New: Build Your Dream Home in');
});

function sampleFreelyGuide() {
  return {
    status: 'success',
    data: {
      programs: [
        {
          service_id: '37123',
          title: 'BBC One South',
          events: [
            {
              main_title: 'The One Show',
              start_time: '2026-06-11T17:00:00+0000',
              duration: 'PT30M',
              synopsis: { short: 'A long programme description.' },
              image_url: 'https://example.test/image.jpg'
            },
            {
              main_title: 'Antiques Roadshow',
              start_time: '2026-06-11T17:30:00+0000',
              duration: 'PT45M'
            },
            {
              main_title: 'EastEnders',
              start_time: '2026-06-11T18:00:00+0000',
              duration: 'PT30M'
            },
            {
              main_title: 'Sort Your Life Out',
              start_time: '2026-06-11T19:00:00+0000',
              duration: 'PT1H30M'
            },
            {
              main_title: 'BBC South Today',
              start_time: '2026-06-11T21:30:00+0000',
              duration: 'PT30M'
            },
            {
              main_title: 'Question Time',
              start_time: '2026-06-11T22:00:00+0000',
              duration: 'PT1H'
            },
            {
              main_title: 'Late News',
              start_time: '2026-06-11T22:01:00+0000',
              duration: 'PT30M'
            }
          ]
        },
        {
          service_id: '37184',
          title: 'BBC Two',
          events: [
            {
              main_title: 'The Secret Genius of Modern Life',
              start_time: '2026-06-11T18:55:00+0000',
              duration: 'PT1H'
            }
          ]
        },
        { service_id: '37641', title: 'ITV1', events: [] },
        { service_id: '37889', title: 'Channel 4', events: [] },
        { service_id: '38145', title: '5', events: [] },
        {
          service_id: '37124',
          title: 'BBC One London',
          events: [{ main_title: 'Wrong region', start_time: '2026-06-11T18:00:00+0000' }]
        }
      ]
    }
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
    }
  };
}

function responseStub({ body, contentType, status = 200 }) {
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
