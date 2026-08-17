const { isEmailLoginEnabled } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    emailLoginEnabled: isEmailLoginEnabled(),
    siteName: 'CineSubz',
  });
};
