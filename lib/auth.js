const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const COOKIE_NAME = 'cs_session';
const SECRET = process.env.JWT_SECRET;

function assertSecret() {
  if (!SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(payload) {
  assertSecret();
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  assertSecret();
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

function isEmailLoginEnabled() {
  // Default ON unless explicitly disabled via env var in Vercel project settings.
  return process.env.EMAIL_LOGIN_ENABLED !== 'false';
}

function generateOtp() {
  // 6-digit numeric code, zero-padded.
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function hashOtp(otp) {
  assertSecret();
  return crypto.createHmac('sha256', SECRET).update(otp).digest('hex');
}

function compareOtp(otp, hash) {
  return hashOtp(otp) === hash;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  isEmailLoginEnabled,
  generateOtp,
  hashOtp,
  compareOtp,
};
