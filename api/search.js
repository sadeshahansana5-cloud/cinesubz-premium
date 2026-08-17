const { getDb } = require('../lib/db');
const { getSessionUser } = require('../lib/auth');

const API_KEY = process.env.MOVIE_API_KEY;
const API_BASES = (process.env.MOVIE_API_BASES ||
  'https://www.sadaslk.com/api/v1/movie,https://back.asitha.top/api,https://apis.sadas.dev/api/v1/movie'
).split(',').map((s) => s.trim()).filter(Boolean);

async function fetchFromUpstream(query) {
  let lastErr = null;
  for (const base of API_BASES) {
    try {
      const url = new URL(base + '/cinesubz/search');
      url.searchParams.set('q', query);
      if (API_KEY) url.searchParams.set('apiKey', API_KEY);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 9000);
      const r = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data && (data.status || (data.data && data.data.length))) {
        return data;
      }
      lastErr = new Error('Empty response from ' + base);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All upstream APIs failed');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Please log in to search movies.' });
    return;
  }

  const query = (req.query.q || '').toString().trim();
  if (!query) {
    res.status(400).json({ ok: false, error: 'Search query is required.' });
    return;
  }

  let db;
  try {
    db = await getDb();
  } catch (e) {
    console.error('db connect error', e);
  }

  try {
    const data = await fetchFromUpstream(query);
    const results = data.data || [];

    // Persist every result to MongoDB so the catalog keeps working even if the
    // upstream API key stops working later. Upsert keyed on the movie link.
    if (db && results.length) {
      const movies = db.collection('movies');
      const ops = results
        .filter((m) => m && m.link)
        .map((m) => ({
          updateOne: {
            filter: { link: m.link },
            update: {
              $set: {
                title: m.title || 'Unknown',
                image: m.image || m.poster || '',
                quality: m.quality || '',
                imdb_rating: m.imdb_rating || '',
                link: m.link,
                lastSeenAt: new Date(),
              },
              $setOnInsert: { firstSeenAt: new Date() },
            },
            upsert: true,
          },
        }));
      if (ops.length) {
        movies.bulkWrite(ops, { ordered: false }).catch((e) => console.error('bulkWrite error', e));
      }
    }

    res.status(200).json({ ok: true, source: 'live', data: results });
  } catch (e) {
    console.warn('upstream search failed, falling back to cache:', e.message);

    if (!db) {
      res.status(502).json({ ok: false, error: 'Search is temporarily unavailable.' });
      return;
    }

    try {
      const movies = db.collection('movies');
      const regex = new RegExp(query.split(/\s+/).filter(Boolean).join('|'), 'i');
      const cached = await movies
        .find({ title: regex })
        .sort({ lastSeenAt: -1 })
        .limit(40)
        .toArray();

      if (!cached.length) {
        res.status(502).json({ ok: false, error: 'Search API is unavailable right now and no cached results matched.' });
        return;
      }

      res.status(200).json({ ok: true, source: 'cache', data: cached });
    } catch (dbErr) {
      console.error('cache fallback error', dbErr);
      res.status(502).json({ ok: false, error: 'Search is temporarily unavailable.' });
    }
  }
};
