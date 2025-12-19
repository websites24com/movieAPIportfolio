const express = require('express');

const authController = require('../controllers/authController')

const router = express.Router();

// JWT local auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// Google OAuth (later)
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
