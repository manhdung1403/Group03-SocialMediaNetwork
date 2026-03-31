const sql = require('mssql');
const { getPool } = require('./db');

const UserModel = {
    async findByEmail(email) {
        const pool = await getPool();
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id, username, email, password FROM Users WHERE email = @email');
        return result.recordset[0] || null;
    },

    async findById(userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`SELECT id, username, email, avatar, bio, dob, created_at, is_private,
                    (SELECT COUNT(*) FROM Follows WHERE follower_id = @userId) AS following_count,
                    (SELECT COUNT(*) FROM Follows WHERE following_id = @userId) AS followers_count
                FROM Users WHERE id = @userId`);
        return result.recordset[0] || null;
    },

    async create(username, email, hashedPassword, dob) {
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, hashedPassword)
            .input('dob', sql.Date, dob)
            .query(`INSERT INTO Users (username, email, password, dob) 
                    OUTPUT INSERTED.id, INSERTED.username, INSERTED.email
                    VALUES (@username, @email, @password, @dob)`);
        return result.recordset[0] || null;
    },

    async checkEmailExists(email, userId = null) {
        const pool = await getPool();
        let query = 'SELECT id FROM Users WHERE email = @email';
        let request = pool.request().input('email', sql.VarChar, email);

        if (userId) {
            query += ' AND id <> @userId';
            request = request.input('userId', sql.Int, userId);
        }

        const result = await request.query(query);
        return result.recordset.length > 0;
    },

    async update(userId, { username, email, bio, dob, avatar, is_private }) {
        const pool = await getPool();
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

        return await this.findById(userId);
    },

    async updatePrivacy(userId, is_private) {
        const pool = await getPool(); 
        await pool.request()
            .input('is_private', sql.Bit, is_private ? 1 : 0) // Chuyển đổi true/false sang 1/0
            .input('userId', sql.Int, userId) // Chỉ định ID người dùng cần cập nhật
            .query(`UPDATE Users SET is_private = @is_private WHERE id = @userId`);
    },

    async listUsers(currentUserId, search = '') {
        const pool = await getPool();
        let request = pool.request().input('me', sql.Int, currentUserId);

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

        return result.recordset;
    },

    async getUserById(currentUserId, targetId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('me', sql.Int, currentUserId)
            .input('targetId', sql.Int, targetId)
            .query(`SELECT u.id, u.username, u.email, u.avatar, u.bio, u.dob, u.created_at, u.is_private,
                    (SELECT COUNT(*) FROM Follows WHERE follower_id = u.id) AS following_count,
                    (SELECT COUNT(*) FROM Follows WHERE following_id = u.id) AS followers_count,
                    CASE WHEN f.follower_id IS NULL THEN 0 ELSE 1 END AS is_following
                FROM Users u
                LEFT JOIN Follows f ON f.following_id = u.id AND f.follower_id = @me
                WHERE u.id = @targetId`);
        return result.recordset[0] || null;
    },

    async updateLastSeen(userId) {
        const pool = await getPool();
        await pool.request()
            .input('uid', sql.Int, userId)
            .query(`UPDATE Users SET last_seen = GETDATE() WHERE id = @uid`);
    }
};

module.exports = UserModel;
