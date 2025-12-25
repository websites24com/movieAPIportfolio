const express = require('express');

const router = express.Router();

// --------------------
// Render HOME page
// --------------------
router.get('/', (req, res) => {
    res.render('home');
});

// --------------------
// Render LOGIN page
// --------------------
router.get('/login', (req, res) => {
    res.render('login', {
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        baseUrl: '/api/v1/auth' // kept explicit, not guessed elsewhere
    });
});

// Render REGISTER page
router.get('/register', (req, res) => {
  res.render('register');
});

// Render FORGOT PASSWORD page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// Reset password

router.get('/reset-password/:token', (req, res) => {
  res.render('reset-password', {
    token: req.params.token
  })
})

// --------------------
// Render HOME page
// --------------------
router.get('/', (req, res) => {
    res.render('home');
});

// --------------------
// Render LOGIN page
// --------------------
router.get('/login', (req, res) => {
    res.render('login', {
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        baseUrl: '/api/v1/auth' // kept explicit, not guessed elsewhere
    });
});

// Render REGISTER page
router.get('/register', (req, res) => {
  res.render('register');
});

// Render FORGOT PASSWORD page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// Reset password

router.get('/reset-password/:token', (req, res) => {
  res.render('reset-password', {
    token: req.params.token
  })
})

// Change password

router.get('/change-password', (req, res) => {
  res.render('change-password');
})


module.exports = router;



