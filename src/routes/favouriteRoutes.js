// src/routes/favoriteRoutes.js

const express = require('express');

const auth = require('../middlewares/auth');
const requireCsrf = require('../middlewares/requireCsrf');
const favoriteController = require('../controllers/favoriteController');

const router = express.Router();

// All favorites routes belong to the currently authenticated user
router.use(auth.protect);

// Read-only: list my favorites (no CSRF needed)
router.get('/', favoriteController.getMyFavorites);

// State-changing: MUST have CSRF (because cookie auth)
router.post('/', requireCsrf, favoriteController.addFavorite);
router.delete('/:movieId', requireCsrf, favoriteController.removeFavorite);

module.exports = router;
