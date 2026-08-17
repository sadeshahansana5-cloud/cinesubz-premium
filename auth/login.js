const { getDb } = require('../../lib/db');
const { comparePassword, signToken, setSessionCookie, isEmailLoginEnabled } = require('../../lib/auth');

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
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').toString().trim().toLowerCase();

    if (!cleanEmail || !password) {
      res.status(400).json({ ok: false, error: 'Email and password are required.' });
      return;
    }

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ email: cleanEmail });

    if (!user) {
      res.status(401).json({ ok: false, error: 'Invalid email or password.' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ ok: false, error: 'Invalid email or password.' });
      return;
    }

    await users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const token = signToken({ uid: user._id.toString(), email: user.email, name: user.name });
    setSessionCookie(res, token);

    res.status(200).json({ ok: true, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ ok: false, error: 'Login failed. Please try again.' });
  }
};
