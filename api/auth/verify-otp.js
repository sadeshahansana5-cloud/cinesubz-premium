const { getDb } = require('../../lib/db');
const { compareOtp, signToken, setSessionCookie, isEmailLoginEnabled } = require('../../lib/auth');

const MAX_ATTEMPTS = 5;

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
    const { email, otp } = req.body || {};
    const cleanEmail = (email || '').toString().trim().toLowerCase();
    const cleanOtp = (otp || '').toString().trim();

    if (!cleanEmail || !cleanOtp) {
      res.status(400).json({ ok: false, error: 'Email and code are required.' });
      return;
    }

    const db = await getDb();
    const pending = db.collection('pending_registrations');
    const users = db.collection('users');

    const doc = await pending.findOne({ email: cleanEmail });
    if (!doc) {
      res.status(400).json({ ok: false, error: 'No pending verification found for this email. Please sign up again.' });
      return;
    }

    if (new Date(doc.otpExpiresAt).getTime() < Date.now()) {
      await pending.deleteOne({ email: cleanEmail });
      res.status(400).json({ ok: false, error: 'This code has expired. Please sign up again to get a new one.' });
      return;
    }

    if ((doc.attempts || 0) >= MAX_ATTEMPTS) {
      await pending.deleteOne({ email: cleanEmail });
      res.status(400).json({ ok: false, error: 'Too many incorrect attempts. Please sign up again to get a new code.' });
      return;
    }

    if (!compareOtp(cleanOtp, doc.otpHash)) {
      const attempts = (doc.attempts || 0) + 1;
      await pending.updateOne({ email: cleanEmail }, { $set: { attempts } });
      const left = MAX_ATTEMPTS - attempts;
      res.status(400).json({ ok: false, error: left > 0 ? `Incorrect code. ${left} attempt(s) left.` : 'Too many incorrect attempts. Please sign up again.' });
      return;
    }

    await users.createIndex({ email: 1 }, { unique: true });
    const now = new Date();
    let userId;
    try {
      const result = await users.insertOne({
        name: doc.name,
        email: cleanEmail,
        passwordHash: doc.passwordHash,
        emailVerified: true,
        createdAt: now,
        lastLoginAt: now,
      });
      userId = result.insertedId;
    } catch (insertErr) {
      if (insertErr && insertErr.code === 11000) {
        res.status(409).json({ ok: false, error: 'An account with this email already exists. Try signing in instead.' });
        return;
      }
      throw insertErr;
    }

    await pending.deleteOne({ email: cleanEmail });

    const token = signToken({ uid: userId.toString(), email: cleanEmail, name: doc.name });
    setSessionCookie(res, token);

    res.status(201).json({ ok: true, user: { id: userId.toString(), name: doc.name, email: cleanEmail } });
  } catch (e) {
    console.error('verify-otp error', e);
    res.status(500).json({ ok: false, error: 'Verification failed. Please try again.' });
  }
};
