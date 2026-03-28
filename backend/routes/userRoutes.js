const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/api/user/profile', requireAuth, userController.getProfile);
router.put('/api/user/profile', requireAuth, userController.updateProfile);
router.put('/api/user/privacy', requireAuth, userController.updatePrivacy);
router.get('/api/users', requireAuth, userController.listUsers);
router.get('/api/users/:id', requireAuth, userController.getUserById);

module.exports = router;
