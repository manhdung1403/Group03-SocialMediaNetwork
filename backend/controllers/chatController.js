const ChatService = require('../services/ChatService');

module.exports = function createChatController({ onlineUsers, emitToUser, io }) {
    async function getMessagesWithReceiver(req, res) {
        try {
            const receiverId = req.params.receiverId;
            const messages = await ChatService.getMessagesWithReceiver(req.session.userId, receiverId);
            return res.json(messages);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function listConversations(req, res) {
        try {
            const conversations = await ChatService.listConversations(req.session.userId);
            const rows = conversations.map(r => ({
                ...r,
                other_is_online: onlineUsers.has(String(r.other_id))
            }));
            return res.json(rows);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function unreadTotal(req, res) {
        try {
            const unreadCount = await ChatService.getUnreadCount(req.session.userId);
            return res.json({ unreadCount: Number(unreadCount) || 0 });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function markRead(req, res) {
        try {
            const convId = parseInt(req.params.id, 10);
            const result = await ChatService.markRead(convId, req.session.userId);
            emitToUser(req.session.userId, 'unread_badge_update');
            return res.json(result);
        } catch (err) {
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({ error: err.message });
        }
    }

    async function listConversationMessages(req, res) {
        try {
            const convId = parseInt(req.params.id, 10);
            const rows = await ChatService.listConversationMessages(convId);
            return res.json(rows);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function createConversation(req, res) {
        try {
            const { participantIds, title, isGroup } = req.body;
            const result = await ChatService.createConversation(participantIds, title, isGroup, req.session.userId);
            return res.json({ success: true, ...result });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function listParticipants(req, res) {
        try {
            const convId = parseInt(req.params.id, 10);
            const participants = await ChatService.listParticipants(convId);
            const rows = participants.map(u => ({
                ...u,
                is_online: onlineUsers.has(String(u.id))
            }));
            return res.json(rows);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    async function deleteConversation(req, res) {
        try {
            const convId = parseInt(req.params.id, 10);
            const result = await ChatService.deleteConversation(convId, req.session.userId);
            io.to(`conversation_${convId}`).emit('conversation_deleted', { conversationId: convId });
            return res.json(result);
        } catch (err) {
            console.error('Delete conversation error', err);
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({ error: err.message });
        }
    }

    return {
        getMessagesWithReceiver,
        listConversations,
        unreadTotal,
        markRead,
        listConversationMessages,
        createConversation,
        listParticipants,
        deleteConversation
    };
};

