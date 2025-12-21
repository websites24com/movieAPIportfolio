const express = require('express');

const authController = require('../controllers/authController');

const auth = require('../middleware/auth')

const router = express.Router();

// JWT local auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout)

router.patch('/change-password', auth.protect, authController.changePassword)
router.post('/forgot-password', authController.forgotPassword)
router.patch('/reset-password/:token', authController.resetPassword); // NEW


// Google OAuth (later)
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
