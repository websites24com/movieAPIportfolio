const express = require('express');

const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const requireCsrf = require('../middlewares/requireCsrf');

const router = express.Router();

// ====================
// Public auth routes
// (but they set the JWT cookie in browser)
// => SHOULD have CSRF too
// ====================
router.post('/register', requireCsrf, authController.register);
router.post('/login', requireCsrf, authController.login);
router.post('/google', requireCsrf, authController.googleAuth);

// ====================
// Password reset flow
// (optional CSRF; not required for correctness)
// ====================
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

// ====================
// Cookie-authenticated + state-changing
// => MUST have CSRF
// ====================
router.post('/logout', auth.protect, requireCsrf, authController.logout);
router.patch('/change-password', auth.protect, requireCsrf, authController.changePassword);

module.exports = router;
