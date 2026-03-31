const NotificationModel = require('../models/notificationModel');

const NotificationService = {
    // Chuyển tiếp yêu cầu tạo thông báo xuống Model
    async create(payload) {
        return NotificationModel.create(payload);
    },

    // Lấy danh sách thông báo của một người dùng
    async list(userId) {
        const items = await NotificationModel.getByUserId(userId); // Gọi model lấy data
        return { success: true, notifications: items }; // Trả về object kết quả
    },

    // Đánh dấu tất cả thông báo của user là đã đọc
    async markAllRead(userId) {
        await NotificationModel.markAllRead(userId); // Gọi model update is_read = 1
        return { success: true };
    }
};

module.exports = NotificationService;
