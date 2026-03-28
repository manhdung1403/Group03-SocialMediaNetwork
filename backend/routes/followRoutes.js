const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const followController = require('../controllers/followController');

const router = express.Router();

router.post('/api/follow', requireAuth, followController.follow);
router.post('/api/unfollow', requireAuth, followController.unfollow);

module.exports = router;
