const { getDb } = require('../lib/db');
const { getSessionUser } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Please log in.' });
    return;
  }

  try {
    const db = await getDb();
    const movies = db.collection('movies');
    const items = await movies.find({}).sort({ lastSeenAt: -1 }).limit(12).toArray();
    res.status(200).json({ ok: true, data: items });
  } catch (e) {
    console.error('trending error', e);
    // Fail soft: the homepage falls back to curated suggestion chips instead of an error.
    res.status(200).json({ ok: true, data: [] });
  }
};
