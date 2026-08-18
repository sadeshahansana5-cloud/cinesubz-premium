const { getDb } = require('../../lib/db');
const { generateOtp, hashOtp, isEmailLoginEnabled } = require('../../lib/auth');
const { sendOtpEmail } = require('../../lib/mailer');

const OTP_TTL_MS = 10 * 60 * 1000;
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
    const { email } = req.body || {};
    const cleanEmail = (email || '').toString().trim().toLowerCase();
    if (!cleanEmail) {
      res.status(400).json({ ok: false, error: 'Email is required.' });
      return;
    }

    const db = await getDb();
    const pending = db.collection('pending_registrations');
    const doc = await pending.findOne({ email: cleanEmail });

    if (!doc) {
      res.status(400).json({ ok: false, error: 'No pending verification found for this email. Please sign up again.' });
      return;
    }

    if (doc.lastSentAt && (Date.now() - new Date(doc.lastSentAt).getTime()) < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(doc.lastSentAt).getTime())) / 1000);
      res.status(429).json({ ok: false, error: `Please wait ${waitSec}s before requesting another code.` });
      return;
    }

    const otp = generateOtp();
    await pending.updateOne(
      { email: cleanEmail },
      {
        $set: {
          otpHash: hashOtp(otp),
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
          attempts: 0,
          lastSentAt: new Date(),
        },
      }
    );

    await sendOtpEmail(cleanEmail, doc.name, otp);

    res.status(200).json({ ok: true, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (e) {
    console.error('resend-otp error', e);
    res.status(500).json({ ok: false, error: 'Could not resend the code. Please try again shortly.' });
  }
};
