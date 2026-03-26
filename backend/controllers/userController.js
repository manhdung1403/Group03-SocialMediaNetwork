const sql = require('mssql');
const dbConfig = require('../config/db');

async function getProfile(req, res) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('userId', sql.Int, req.session.userId)
            .query(`SELECT id, username, email, avatar, bio, dob, created_at, is_private,
                    (SELECT COUNT(*) FROM Follows WHERE follower_id = @userId) AS following_count,
                    (SELECT COUNT(*) FROM Follows WHERE following_id = @userId) AS followers_count
                FROM Users WHERE id = @userId`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        const user = result.recordset[0];
        return res.json(user);
    } catch (err) {
        console.error('Lỗi lấy profile:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function updateProfile(req, res) {
    try {
        const { username, email, bio, dob, avatar, is_private } = req.body;
        const userId = req.session.userId;

        if (!username || !email) {
            return res.status(400).json({ error: 'Username và Email không được để trống' });
        }

        if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            return res.status(400).json({ error: 'Định dạng ngày sinh không hợp lệ' });
        }

        const pool = await sql.connect(dbConfig);
        const emailCheck = await pool.request()
            .input('email', sql.VarChar, email)
            .input('userId', sql.Int, userId)
            .query(`SELECT id FROM Users WHERE email = @email AND id <> @userId`);

        if (emailCheck.recordset.length > 0) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        let updateQuery = `UPDATE Users SET username = @username, email = @email, bio = @bio, is_private = @is_private`;
        let request = pool.request()
            .input('username', sql.NVarChar, username)
            .input('email', sql.VarChar, email)
            .input('bio', sql.NVarChar(sql.MAX), bio || null)
            .input('userId', sql.Int, userId)
            .input('is_private', sql.Bit, is_private ? 1 : 0);

        if (dob) {
            updateQuery += `, dob = @dob`;
            request = request.input('dob', sql.Date, dob);
        }

        if (avatar) {
            updateQuery += `, avatar = @avatar`;
            request = request.input('avatar', sql.NVarChar(sql.MAX), avatar);
        }

        updateQuery += ` WHERE id = @userId`;

        await request.query(updateQuery);

        req.session.username = username;

        const updated = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT id, username, email, avatar, bio, dob FROM Users WHERE id = @userId`);

        return res.json({
            success: true,
            message: 'Cập nhật profile thành công',
            user: updated.recordset[0]
        });
    } catch (err) {
        console.error('Lỗi cập nhật profile:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function updatePrivacy(req, res) {
    try {
        const { is_private } = req.body;
        const userId = req.session.userId;

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('is_private', sql.Bit, is_private ? 1 : 0)
            .input('userId', sql.Int, userId)
            .query(`UPDATE Users SET is_private = @is_private WHERE id = @userId`);

        return res.json({ success: true, is_private });
    } catch (err) {
        console.error('Lỗi cập nhật privacy:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function listUsers(req, res) {
    try {
        const me = req.session.userId;
        const search = (req.query.search || '').trim();

        const pool = await sql.connect(dbConfig);
        let request = pool.request().input('me', sql.Int, me);

        let whereClause = 'WHERE u.id <> @me';
        if (search) {
            whereClause += ' AND u.username LIKE @search';
            request = request.input('search', sql.NVarChar, `%${search}%`);
        }

        const result = await request.query(`
            SELECT u.id,
                u.username,
                u.avatar,
                ISNULL(fc.followers_count, 0) AS followers_count,
                CASE WHEN f.follower_id IS NULL THEN 0 ELSE 1 END AS is_following
            FROM Users u
            LEFT JOIN (SELECT following_id, COUNT(*) AS followers_count FROM Follows GROUP BY following_id) fc
                ON fc.following_id = u.id
            LEFT JOIN Follows f ON f.following_id = u.id AND f.follower_id = @me
            ${whereClause}
            ORDER BY ISNULL(fc.followers_count, 0) DESC, u.username ASC
        `);

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

async function getUserById(req, res) {
    try {
        const me = req.session.userId;
        const targetId = parseInt(req.params.id, 10);
        if (isNaN(targetId)) return res.status(400).json({ error: 'userId không hợp lệ' });

        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('me', sql.Int, me)
            .input('targetId', sql.Int, targetId)
            .query(`SELECT u.id, u.username, u.email, u.avatar, u.bio, u.dob, u.created_at, u.is_private,
                    (SELECT COUNT(*) FROM Follows WHERE follower_id = u.id) AS following_count,
                    (SELECT COUNT(*) FROM Follows WHERE following_id = u.id) AS followers_count,
                    CASE WHEN f.follower_id IS NULL THEN 0 ELSE 1 END AS is_following
                FROM Users u
                LEFT JOIN Follows f ON f.following_id = u.id AND f.follower_id = @me
                WHERE u.id = @targetId`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy user' });
        }

        return res.json(result.recordset[0]);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

module.exports = {
    getProfile,
    updateProfile,
    updatePrivacy,
    listUsers,
    getUserById
};

