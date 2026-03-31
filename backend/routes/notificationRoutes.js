const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/api/notifications', requireAuth, notificationController.getNotifications);
router.put('/api/notifications/read-all', requireAuth, notificationController.markAllNotificationsRead);

module.exports = router;
