const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const authController = require('../controllers/authController');
const uploadController = require('../controllers/uploadController');
const userController = require('../controllers/userController');
const postsController = require('../controllers/postsController');
const followController = require('../controllers/followController');
const createChatController = require('../controllers/chatController');

module.exports = function createApiRouter({ upload, onlineUsers, emitToUser, io }) {
    const router = express.Router();
    const chatController = createChatController({ onlineUsers, emitToUser, io });

    // UPLOAD
    router.post('/api/upload-image', requireAuth, upload.single('image'), uploadController.uploadImage);

    // AUTH
    router.post('/api/register', authController.register);
    router.post('/api/login', authController.login);
    router.post('/api/logout', authController.logout);
    router.get('/api/auth/status', authController.authStatus);

    // USER PROFILE
    router.get('/api/user/profile', requireAuth, userController.getProfile);
    router.put('/api/user/profile', requireAuth, userController.updateProfile);
    router.put('/api/user/privacy', requireAuth, userController.updatePrivacy);

    // POSTS
    router.get('/api/posts/debug', requireAuth, postsController.debugPosts);
    router.get('/api/posts', requireAuth, postsController.getPosts);
    router.post('/api/posts', requireAuth, postsController.createPost);
    router.put('/api/posts/:id', requireAuth, postsController.updatePost);
    router.post('/api/posts/:id/like', requireAuth, postsController.toggleLike);

    // USERS
    router.get('/api/users', requireAuth, userController.listUsers);
    router.get('/api/users/:id', requireAuth, userController.getUserById);

    // FOLLOW
    router.post('/api/follow', requireAuth, followController.follow);
    router.post('/api/unfollow', requireAuth, followController.unfollow);

    // CHAT / CONVERSATION
    router.get('/api/messages/:receiverId', requireAuth, chatController.getMessagesWithReceiver);
    router.get('/api/conversations', requireAuth, chatController.listConversations);
    router.get('/api/conversations/unread-total', requireAuth, chatController.unreadTotal);
    router.post('/api/conversations/:id/mark-read', requireAuth, chatController.markRead);
    router.get('/api/conversations/:id/messages', requireAuth, chatController.listConversationMessages);
    router.post('/api/conversations', requireAuth, chatController.createConversation);
    router.get('/api/conversations/:id/participants', requireAuth, chatController.listParticipants);
    router.delete('/api/conversations/:id', requireAuth, chatController.deleteConversation);

    return router;
};

