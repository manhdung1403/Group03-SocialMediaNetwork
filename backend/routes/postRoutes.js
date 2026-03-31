const express = require('express');
const requireAuth = require('../middlewares/requireAuth');

module.exports = function createPostRoutes({ emitToUser }) {
    const router = express.Router();
    const postsController = require('../controllers/postsController')({ emitToUser });

    router.get('/api/posts/debug', requireAuth, postsController.debugPosts);
    router.get('/api/posts', requireAuth, postsController.getPosts);
    router.post('/api/posts', requireAuth, postsController.createPost);
    router.put('/api/posts/:id', requireAuth, postsController.updatePost);
    router.put('/api/posts/:id/privacy', requireAuth, postsController.togglePostPrivacy);
    router.delete('/api/posts/:id', requireAuth, postsController.deletePost);
    router.post('/api/posts/:id/like', requireAuth, postsController.toggleLike);
    router.get('/api/posts/:id/comments', requireAuth, postsController.getComments);
    router.post('/api/posts/:id/comments', requireAuth, postsController.createComment);
    router.delete('/api/comments/:commentId', requireAuth, postsController.deleteComment);
    router.post('/api/posts/:id/comments/:commentId/like', requireAuth, postsController.toggleCommentLike);

    return router;
};
