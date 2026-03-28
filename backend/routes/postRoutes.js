const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const postsController = require('../controllers/postsController');

const router = express.Router();

router.get('/api/posts/debug', requireAuth, postsController.debugPosts);
router.get('/api/posts', requireAuth, postsController.getPosts);
router.post('/api/posts', requireAuth, postsController.createPost);
router.put('/api/posts/:id', requireAuth, postsController.updatePost);
router.put('/api/posts/:id/privacy', requireAuth, postsController.togglePostPrivacy);
router.delete('/api/posts/:id', requireAuth, postsController.deletePost);
router.post('/api/posts/:id/like', requireAuth, postsController.toggleLike);

module.exports = router;
