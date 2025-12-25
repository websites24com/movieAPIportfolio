// src/utils/jwtCookie.js
// Single source of truth for JWT cookie settings (set + clear must always match)

function getJwtCookieBaseOptions() {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/', // critical: ensures delete matches set
  };
}

function setJwtCookie(res, token) {
  const cookieDays = Number(process.env.JWT_COOKIE_EXPIRES_IN || 7);
  const expires = new Date(Date.now() + cookieDays * 24 * 60 * 60 * 1000);

  res.cookie('jwt', token, {
    ...getJwtCookieBaseOptions(),
    expires,
  });
}

function clearJwtCookie(res) {
  // Set cookie in the past with SAME options (especially path) to remove it reliably
  res.cookie('jwt', '', {
    ...getJwtCookieBaseOptions(),
    expires: new Date(0),
  });
}

module.exports = {
  setJwtCookie,
  clearJwtCookie,
};

