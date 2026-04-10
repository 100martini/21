const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, profileController.getProfile);
router.put('/', authMiddleware, profileController.updateProfile);

module.exports = router;
