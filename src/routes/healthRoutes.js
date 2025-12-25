const express = require('express');
const healthController = require('../controllers/healthController')

const router = express.Router();

router.get('/health', healthController.healthCheck);
router.get('/db-check', healthController.dbCheck)

module.exports = router;