const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const postRoutes = require('./postRoutes');
const followRoutes = require('./followRoutes');
const createUploadRoutes = require('./uploadRoutes');
const createChatRoutes = require('./chatRoutes');

module.exports = function createApiRouter({ upload, onlineUsers, emitToUser, io }) {
    const router = express.Router();

    // Mount all routes
    router.use(authRoutes);
    router.use(userRoutes);
    router.use(postRoutes);
    router.use(followRoutes);
    router.use(createUploadRoutes({ upload }));

    // Chat controller depends on Socket.IO context
    const chatController = require('../controllers/chatController')({ onlineUsers, emitToUser, io });
    router.use(createChatRoutes({ chatController }));

    return router;
};


