// src/routes/userRoutes.js

const express = require('express');

const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

const router = express.Router();

// Current user profile
router.get('/me', auth.protect, userController.getMe);

module.exports = router;
