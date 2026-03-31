const AuthService = require('../services/AuthService');

async function register(req, res) {
    try {
        const { username, email, password, dob } = req.body;
        const newUser = await AuthService.register(username, email, password, dob);

        req.session.userId = newUser.id;
        req.session.username = newUser.username;

        return res.json({ success: true, message: 'Đăng ký thành công', user: newUser });
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        const statusCode = err.statusCode || 500;
        const message = err.message || 'Lỗi server: ' + err.message;
        return res.status(statusCode).json({ error: message });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        const user = await AuthService.login(email, password);

        req.session.userId = user.id;
        req.session.username = user.username;

        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        const statusCode = err.statusCode || 500;
        const message = err.message || 'Lỗi server: ' + err.message;
        return res.status(statusCode).json({ error: message });
    }
}

async function logout(req, res) {
    const userId = req.session && req.session.userId;
    if (userId) {
        try {
            await AuthService.updateLastSeen(userId);
        } catch (e) {
            console.error('logout last_seen error', e);
        }
    }

    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Lỗi khi đăng xuất' });
        return res.json({ success: true, message: 'Đăng xuất thành công' });
    });
}

function authStatus(req, res) {
    if (req.session && req.session.userId) {
        return res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username } });
    }
    return res.json({ loggedIn: false });
}

module.exports = {
    register,
    login,
    logout,
    authStatus
};

