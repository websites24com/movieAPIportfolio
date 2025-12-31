const express = require('express');
const favoriteController = require('../controllers/favoriteController');
const router = express.Router();

// --------------------
// HOME
// --------------------
router.get('/', (req, res) => {
  res.render('pages/home');
});

// --------------------
// LOGIN
// --------------------
router.get('/login', (req, res) => {
  res.render('auth/login', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    baseUrl: '/api/v1/auth'
  });
});

// --------------------
// REGISTER
// --------------------
router.get('/register', (req, res) => {
  res.render('auth/register', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    baseUrl: '/api/v1/auth'
  });
});

// --------------------
// FORGOT PASSWORD
// --------------------
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

// --------------------
// RESET PASSWORD
// --------------------
router.get('/reset-password/:token', (req, res) => {
  res.render('auth/reset-password', {
    token: req.params.token,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

// --------------------
// CHANGE PASSWORD
// --------------------
router.get('/change-password', (req, res) => {
  res.render('auth/change-password', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
  });
});

// --------------------
// ME
// --------------------

router.get('/me', (req, res, next) => {
  if (!res.locals.user) {
    return res.redirect('/login');
  }

  res.status(200).render('users/me', {
    title: 'My Account'
  })
})

// --------------------
// FAVORITES
// --------------------

router.get('/users/favorites', favoriteController.loadFavorites,
(req,res) => {
  return res.status(200).render('users/favorites', {
    favorites: res.locals.favorites
  })
})


module.exports = router;
