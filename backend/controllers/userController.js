const UserService = require('../services/userService');

async function getProfile(req, res) {
    try {
        const user = await UserService.getProfile(req.session.userId);
        return res.json(user);
    } catch (err) {
        console.error('Lỗi lấy profile:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function updateProfile(req, res) {
    try {
        const { username, email, bio, dob, avatar, is_private } = req.body;
        const user = await UserService.updateProfile(req.session.userId, {
            username,
            email,
            bio,
            dob,
            avatar,
            is_private
        });

        req.session.username = username;

        return res.json({
            success: true,
            message: 'Cập nhật profile thành công',
            user
        });
    } catch (err) {
        console.error('Lỗi cập nhật profile:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function updatePrivacy(req, res) {
    try {
        const { is_private } = req.body;
        const result = await UserService.updatePrivacy(req.session.userId, is_private);
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('Lỗi cập nhật privacy:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function listUsers(req, res) {
    try {
        const search = (req.query.search || '').trim();
        const users = await UserService.listUsers(req.session.userId, search);
        return res.json(users);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function getUserById(req, res) {
    try {
        const targetId = parseInt(req.params.id, 10);
        const user = await UserService.getUserById(req.session.userId, targetId);
        return res.json(user);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

module.exports = {
    getProfile,
    updateProfile,
    updatePrivacy,
    listUsers,
    getUserById
};

