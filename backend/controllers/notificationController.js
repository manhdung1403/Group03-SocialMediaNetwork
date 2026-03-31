const NotificationService = require('../services/notificationService');

async function getNotifications(req, res) {
    try {
        const result = await NotificationService.list(req.session.userId);
        return res.json(result);
    } catch (err) {
        console.error('Lỗi lấy thông báo:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function markAllNotificationsRead(req, res) {
    try {
        const result = await NotificationService.markAllRead(req.session.userId);
        return res.json(result);
    } catch (err) {
        console.error('Lỗi cập nhật thông báo:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

module.exports = {
    getNotifications,
    markAllNotificationsRead
};
