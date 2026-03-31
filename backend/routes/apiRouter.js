const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const createPostRoutes = require('./postRoutes');
const followRoutes = require('./followRoutes');
const notificationRoutes = require('./notificationRoutes');
const createUploadRoutes = require('./uploadRoutes');
const createChatRoutes = require('./chatRoutes');

module.exports = function createApiRouter({ upload, onlineUsers, emitToUser, io }) {
    const router = express.Router();

    // Mount all routes
    router.use(authRoutes);
    router.use(userRoutes);
    router.use(createPostRoutes({ emitToUser }));
    router.use(followRoutes);
    router.use(notificationRoutes);
    router.use(createUploadRoutes({ upload }));

    // Chat controller depends on Socket.IO context
    const chatController = require('../controllers/chatController')({ onlineUsers, emitToUser, io });
    router.use(createChatRoutes({ chatController }));

    return router;
};


