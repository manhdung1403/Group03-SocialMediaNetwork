const express = require('express');
const requireAuth = require('../middlewares/requireAuth');

module.exports = function createChatRoutes({ chatController }) {
    const router = express.Router();

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
