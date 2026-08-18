const { getDb } = require('../../lib/db');
const { hashPassword, generateOtp, hashOtp, isEmailLoginEnabled } = require('../../lib/auth');
const { sendOtpEmail } = require('../../lib/mailer');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000;

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
    const pending = db.collection('pending_registrations');
    await users.createIndex({ email: 1 }, { unique: true });
    await pending.createIndex({ email: 1 }, { unique: true });
    await pending.createIndex({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

    const existing = await users.findOne({ email: cleanEmail });
    if (existing) {
      res.status(409).json({ ok: false, error: 'An account with this email already exists. Try signing in instead.' });
      return;
    }

    const existingPending = await pending.findOne({ email: cleanEmail });
    if (existingPending && existingPending.lastSentAt && (Date.now() - new Date(existingPending.lastSentAt).getTime()) < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(existingPending.lastSentAt).getTime())) / 1000);
      res.status(429).json({ ok: false, error: `A code was already sent. Please wait ${waitSec}s before trying again.` });
      return;
    }

    const passwordHash = await hashPassword(password);
    const otp = generateOtp();
    const now = new Date();

    await pending.updateOne(
      { email: cleanEmail },
      {
        $set: {
          name: cleanName,
          email: cleanEmail,
          passwordHash,
          otpHash: hashOtp(otp),
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
          attempts: 0,
          lastSentAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    try {
      await sendOtpEmail(cleanEmail, cleanName, otp);
    } catch (mailErr) {
      console.error('sendOtpEmail failed', mailErr);
      res.status(502).json({ ok: false, error: 'Could not send the verification email. Please check the email address and try again shortly.' });
      return;
    }

    res.status(200).json({ ok: true, stage: 'otp_sent', email: cleanEmail, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
};
