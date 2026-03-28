const MessageModel = require('../models/messageModel');

const ChatService = {
    async getMessagesWithReceiver(senderId, receiverId) {
        return await MessageModel.getMessagesBetween(senderId, receiverId);
    },

    async listConversations(userId) {
        return await MessageModel.listConversations(userId);
    },

    async getUnreadCount(userId) {
        return await MessageModel.getUnreadCount(userId);
    },

    async markRead(convId, userId) {
        const success = await MessageModel.markRead(convId, userId);
        if (!success) {
            throw { statusCode: 403, message: 'Không có quyền' };
        }
        return { success: true };
    },

    async listConversationMessages(convId) {
        return await MessageModel.getConversationMessages(convId);
    },

    async createConversation(participantIds, title, isGroup, currentUserId) {
        const users = Array.from(new Set([currentUserId].concat(participantIds || [])))
            .map(x => parseInt(x, 10));

        const result = await MessageModel.createConversation(title, isGroup, users);
        return result;
    },

    async listParticipants(convId) {
        return await MessageModel.getParticipants(convId);
    },

    async deleteConversation(convId, userId) {
        const success = await MessageModel.deleteConversation(convId, userId);
        if (!success) {
            throw { statusCode: 403, message: 'Không có quyền xóa' };
        }
        return { success: true };
    }
};

module.exports = ChatService;
