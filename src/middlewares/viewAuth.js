// src/middlewares/viewAuth.js
// Purpose: for rendered pages (EJS)
// - If jwt cookie exists and is valid -> load user and attach to res.locals.user
// - If not -> continue without crashing (guest view)

const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.attachUserIfLoggedIn = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.jwt;

    if (!token) {
      res.locals.user = null;
      return next();
    }

    if (!process.env.JWT_SECRET) {
      res.locals.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      res.locals.user = null;
      return next();
    }

    // Load user from DB (minimal fields for rendering)
    const [rows] = await db.query(
      `SELECT id, name, email, role, provider, provider_id, active, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decoded.id]
    );

    const user = rows[0];

    // If user missing or disabled, treat as logged out
    if (!user || Number(user.active) !== 1) {
      res.locals.user = null;
      return next();
    }

    res.locals.user = user;
    return next();
  } catch (err) {
    // Token invalid/expired -> behave like logged out (no error page)
    res.locals.user = null;
    return next();
  }
};
