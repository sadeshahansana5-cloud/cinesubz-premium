const { getDb } = require('../lib/db');
const { getSessionUser } = require('../lib/auth');

// See api/search.js for why this is cache-only: the movie API is fetched
// directly from the browser, and this endpoint is just the MongoDB safety net.

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
    const link = (req.query.url || '').toString().trim();
    if (!link) {
      res.status(400).json({ ok: false, error: 'Movie link is required.' });
      return;
    }
    if (!db) {
      res.status(502).json({ ok: false, error: 'No cached copy is available right now.' });
      return;
    }
    try {
      const details = db.collection('movie_details');
      const cached = await details.findOne({ link });
      if (!cached) {
        res.status(404).json({ ok: false, error: 'No cached copy of this title was found.' });
        return;
      }
      res.status(200).json({ ok: true, source: 'cache', data: cached });
    } catch (e) {
      console.error('cache lookup error', e);
      res.status(502).json({ ok: false, error: 'No cached copy is available right now.' });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!db) {
      res.status(200).json({ ok: true, cached: false });
      return;
    }
    try {
      const { link, data } = req.body || {};
      if (!link || !data || !data.title) {
        res.status(200).json({ ok: true, cached: false });
        return;
      }
      const details = db.collection('movie_details');
      await details.updateOne(
        { link },
        { $set: { ...data, link, lastSeenAt: new Date() }, $setOnInsert: { firstSeenAt: new Date() } },
        { upsert: true }
      );
      res.status(200).json({ ok: true, cached: true });
    } catch (e) {
      console.error('cache write error', e);
      res.status(200).json({ ok: true, cached: false });
    }
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};
