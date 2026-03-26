const sql = require('mssql');
const dbConfig = require('../config/db');

async function follow(req, res) {
    try {
        const me = req.session.userId;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('me', sql.Int, me)
            .input('userId', sql.Int, userId)
            .query(`IF NOT EXISTS (SELECT 1 FROM Follows WHERE follower_id=@me AND following_id=@userId)
                INSERT INTO Follows (follower_id, following_id) VALUES (@me, @userId)`);

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

async function unfollow(req, res) {
    try {
        const me = req.session.userId;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('me', sql.Int, me)
            .input('userId', sql.Int, userId)
            .query(`DELETE FROM Follows WHERE follower_id=@me AND following_id=@userId`);

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { follow, unfollow };

