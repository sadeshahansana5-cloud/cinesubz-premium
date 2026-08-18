const { getDb } = require('../lib/db');
const { getSessionUser } = require('../lib/auth');

// Falls back to the same key the original page shipped with, so the site keeps
// working out of the box. Set MOVIE_API_KEY in Vercel to override it with your own.
const API_KEY = process.env.MOVIE_API_KEY || '844eb9535c14d74716c89ca486ca996e';
const API_BASES = (process.env.MOVIE_API_BASES ||
  'https://www.sadaslk.com/api/v1/movie,https://back.asitha.top/api,https://apis.sadas.dev/api/v1/movie'
).split(',').map((s) => s.trim()).filter(Boolean);

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

async function fetchOne(base, path, params) {
  const url = new URL(base + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (API_KEY) url.searchParams.set('apiKey', API_KEY);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  const r = await fetch(url.toString(), { signal: controller.signal, headers: BROWSER_HEADERS });
  clearTimeout(t);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + base + path);
  return r.json();
}

async function fetchFromUpstream(link) {
  let lastErr = null;
  for (const base of API_BASES) {
    try {
      let data = await fetchOne(base, '/cinesubz/movie-details', { url: link });
      if (!data || !data.status) {
        data = await fetchOne(base, '/cinesubz/info', { q: link });
      }
      if (data && data.data) return data;
      lastErr = new Error('Empty response from ' + base);
    } catch (e) {
      lastErr = e;
      console.warn('[movie] upstream failed:', base, e.message);
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
    res.status(401).json({ ok: false, error: 'Please log in to view movie details.' });
    return;
  }

  const link = (req.query.url || '').toString().trim();
  if (!link) {
    res.status(400).json({ ok: false, error: 'Movie link is required.' });
    return;
  }

  let db;
  try {
    db = await getDb();
  } catch (e) {
    console.error('db connect error', e);
  }

  try {
    const data = await fetchFromUpstream(link);
    const info = data.data || {};

    if (db && info && info.title) {
      const details = db.collection('movie_details');
      details
        .updateOne(
          { link },
          {
            $set: { ...info, link, lastSeenAt: new Date() },
            $setOnInsert: { firstSeenAt: new Date() },
          },
          { upsert: true }
        )
        .catch((e) => console.error('detail cache write error', e));
    }

    res.status(200).json({ ok: true, source: 'live', data: info });
  } catch (e) {
    console.warn('upstream detail failed, falling back to cache:', e.message);

    if (!db) {
      res.status(502).json({ ok: false, error: 'This title is taking longer than usual to load — please try again.' });
      return;
    }

    try {
      const details = db.collection('movie_details');
      const cached = await details.findOne({ link });
      if (!cached) {
        res.status(502).json({ ok: false, error: 'This title is taking longer than usual to load — please try again.' });
        return;
      }
      res.status(200).json({ ok: true, source: 'cache', data: cached });
    } catch (dbErr) {
      console.error('cache fallback error', dbErr);
      res.status(502).json({ ok: false, error: 'This title is taking longer than usual to load — please try again.' });
    }
  }
};
