const { getDb } = require('../lib/db');
const { getSessionUser } = require('../lib/auth');

// The movie API is fetched directly from the browser (see index.html) because
// it's a CORS-enabled public API meant for client use — calling it from a
// Vercel server function gets silently blocked upstream. This endpoint only
// does two things: (1) GET serves a MongoDB fallback if the browser's own
// request to every upstream base fails, and (2) POST lets the browser report
// results it successfully fetched so they get cached for that fallback and
// for the homepage's Trending section.

module.exports = async function handler(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Please log in.' });
    return;
  }

  let db;
  try {
    db = await getDb();
  } catch (e) {
    console.error('db connect error', e);
  }

  if (req.method === 'GET') {
    const query = (req.query.q || '').toString().trim();
    if (!query) {
      res.status(400).json({ ok: false, error: 'Search query is required.' });
      return;
    }
    if (!db) {
      res.status(502).json({ ok: false, error: 'No cached results are available right now.' });
      return;
    }
    try {
      const movies = db.collection('movies');
      const regex = new RegExp(query.split(/\s+/).filter(Boolean).join('|'), 'i');
      const cached = await movies.find({ title: regex }).sort({ lastSeenAt: -1 }).limit(40).toArray();
      if (!cached.length) {
        res.status(404).json({ ok: false, error: 'No cached results matched your search.' });
        return;
      }
      res.status(200).json({ ok: true, source: 'cache', data: cached });
    } catch (e) {
      console.error('cache search error', e);
      res.status(502).json({ ok: false, error: 'No cached results are available right now.' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!db) {
      res.status(200).json({ ok: true, cached: 0 });
      return;
    }
    try {
      const results = (req.body && req.body.results) || [];
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
        await movies.bulkWrite(ops, { ordered: false });
      }
      res.status(200).json({ ok: true, cached: ops.length });
    } catch (e) {
      console.error('cache write error', e);
      res.status(200).json({ ok: true, cached: 0 });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
