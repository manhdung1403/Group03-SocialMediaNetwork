const NotificationModel = require('../models/notificationModel');

const NotificationService = {
    async create(payload) {
        return NotificationModel.create(payload);
    },

    async list(userId) {
        const items = await NotificationModel.getByUserId(userId);
        return { success: true, notifications: items };
    },

    async markAllRead(userId) {
        await NotificationModel.markAllRead(userId);
        return { success: true };
    }
};

module.exports = NotificationService;
