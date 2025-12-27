const express = require('express');
const router = express.Router();

// --------------------
// HOME
// --------------------
router.get('/', (req, res) => {
  res.render('home');
});

// --------------------
// LOGIN
// --------------------
router.get('/login', (req, res) => {
  res.render('login', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    baseUrl: '/api/v1/auth'
  });
});

// --------------------
// REGISTER
// --------------------
router.get('/register', (req, res) => {
  res.render('register', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    baseUrl: '/api/v1/auth'
  });
});

// --------------------
// FORGOT PASSWORD
// --------------------
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

// --------------------
// RESET PASSWORD
// --------------------
router.get('/reset-password/:token', (req, res) => {
  res.render('reset-password', {
    token: req.params.token,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

// --------------------
// CHANGE PASSWORD
// --------------------
router.get('/change-password', (req, res) => {
  res.render('change-password', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

module.exports = router;
