const FollowModel = require('../models/followModel');

const FollowService = {
    async follow(followerId, followingId) {
        if (!followingId) {
            throw { statusCode: 400, message: 'userId required' };
        }
        await FollowModel.follow(followerId, followingId);
        return { success: true };
    },

    async unfollow(followerId, followingId) {
        if (!followingId) {
            throw { statusCode: 400, message: 'userId required' };
        }
        await FollowModel.unfollow(followerId, followingId);
        return { success: true };
    }
};

module.exports = FollowService;
