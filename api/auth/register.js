const { getDb } = require('../../lib/db');
const { hashPassword, signToken, setSessionCookie, isEmailLoginEnabled } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!isEmailLoginEnabled()) {
    res.status(403).json({ ok: false, error: 'Email login is currently disabled by the site admin.' });
    return;
  }

  try {
    const { name, email, password } = req.body || {};
    const cleanName = (name || '').toString().trim();
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      res.status(400).json({ ok: false, error: 'Name, email, and password are all required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ ok: false, error: 'Password must be at least 6 characters.' });
      return;
    }

    const db = await getDb();
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });

    const existing = await users.findOne({ email: cleanEmail });
    if (existing) {
      res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();
    const result = await users.insertOne({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      createdAt: now,
      lastLoginAt: now,
    });

    const token = signToken({ uid: result.insertedId.toString(), email: cleanEmail, name: cleanName });
    setSessionCookie(res, token);

    res.status(201).json({ ok: true, user: { id: result.insertedId.toString(), name: cleanName, email: cleanEmail } });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
};
