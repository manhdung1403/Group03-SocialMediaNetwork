const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/api/register', authController.register);
router.post('/api/login', authController.login);
router.post('/api/logout', authController.logout);
router.get('/api/auth/status', authController.authStatus);

module.exports = router;
