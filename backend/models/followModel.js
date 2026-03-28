const sql = require('mssql');
const { getPool } = require('./db');

const FollowModel = {
    async follow(followerId, followingId) {
        const pool = await getPool();
        await pool.request()
            .input('follower_id', sql.Int, followerId)
            .input('following_id', sql.Int, followingId)
            .query(`IF NOT EXISTS (SELECT 1 FROM Follows WHERE follower_id=@follower_id AND following_id=@following_id)
                INSERT INTO Follows (follower_id, following_id) VALUES (@follower_id, @following_id)`);
        return true;
    },

    async unfollow(followerId, followingId) {
        const pool = await getPool();
        await pool.request()
            .input('follower_id', sql.Int, followerId)
            .input('following_id', sql.Int, followingId)
            .query(`DELETE FROM Follows WHERE follower_id=@follower_id AND following_id=@following_id`);
        return true;
    },

    async isFollowing(followerId, followingId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('follower_id', sql.Int, followerId)
            .input('following_id', sql.Int, followingId)
            .query(`SELECT 1 FROM Follows WHERE follower_id=@follower_id AND following_id=@following_id`);
        return result.recordset.length > 0;
    }
};

module.exports = FollowModel;
