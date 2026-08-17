const { getSessionUser } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ ok: false, authenticated: false });
    return;
  }
  res.status(200).json({
    ok: true,
    authenticated: true,
    user: { id: user.uid, name: user.name, email: user.email },
  });
};
