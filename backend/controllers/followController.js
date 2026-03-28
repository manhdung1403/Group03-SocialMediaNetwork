const FollowService = require('../services/followService');

async function follow(req, res) {
    try {
        const { userId } = req.body;
        const result = await FollowService.follow(req.session.userId, userId);
        return res.json(result);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function unfollow(req, res) {
    try {
        const { userId } = req.body;
        const result = await FollowService.unfollow(req.session.userId, userId);
        return res.json(result);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

module.exports = { follow, unfollow };

