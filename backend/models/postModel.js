const sql = require('mssql');
const { getPool } = require('./db');

const PostModel = {
    async getAll(currentUserId) {
        const pool = await getPool();

        // Check if is_private column exists
        const columnCheck = await pool.request().query(`
            SELECT 1 AS has_column
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Posts' AND COLUMN_NAME = 'is_private'
        `);
        const hasIsPrivate = columnCheck.recordset.length > 0;

        const isPrivateSelect = hasIsPrivate ? 'p.is_private,' : '0 AS is_private,';
        const isPrivateFilter = hasIsPrivate ? '(ISNULL(p.is_private, 0) = 0 OR p.user_id = @currentUserId)' : '1=1';

        const result = await pool.request()
            .input('currentUserId', sql.Int, currentUserId)
            .query(`
                SELECT 
                    p.id,
                    p.image_url,
                    p.caption,
                    ${isPrivateSelect}
                    p.created_at,
                    u.id AS user_id,
                    u.username,
                    u.avatar AS user_avatar,
                    u.is_private AS user_is_private,
                    ISNULL(lc.like_count, 0) AS like_count,
                    ISNULL(cc.comment_count, 0) AS comment_count,
                    CASE WHEN ul.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_current_user,
                    CASE WHEN f.follower_id IS NULL THEN 0 ELSE 1 END AS is_following
                FROM Posts p
                LEFT JOIN Users u ON p.user_id = u.id
                LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM Likes
                    GROUP BY post_id
                ) lc ON lc.post_id = p.id
                LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM Comments
                    GROUP BY post_id
                ) cc ON cc.post_id = p.id
                LEFT JOIN Likes ul
                    ON ul.post_id = p.id AND ul.user_id = @currentUserId
                LEFT JOIN Follows f
                    ON f.following_id = u.id AND f.follower_id = @currentUserId
                WHERE (ISNULL(u.is_private, 0) = 0 OR p.user_id = @currentUserId)
                  AND ${isPrivateFilter}
                ORDER BY p.created_at DESC
            `);

        return result.recordset;
    },

    async create(userId, image_url, caption) {
        const pool = await getPool();
        const result = await pool.request()
            .input('user_id', sql.Int, userId)
            .input('image_url', sql.NVarChar(sql.MAX), image_url)
            .input('caption', sql.NVarChar, caption || null)
            .query(`
                INSERT INTO Posts (user_id, image_url, caption, created_at)
                OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.image_url, INSERTED.caption, INSERTED.created_at
                VALUES (@user_id, @image_url, @caption, GETDATE())
            `);

        return result.recordset[0] || null;
    },

    async findById(postId, userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        return result.recordset.length > 0;
    },

    async update(postId, userId, { caption, image_url }) {
        const pool = await getPool();
        let updateQuery = 'UPDATE Posts SET ';
        const params = [];

        if (caption !== undefined) {
            updateQuery += 'caption = @caption';
            params.push({ name: 'caption', type: sql.NVarChar, value: caption || null });
        }
        if (image_url !== undefined) {
            if (params.length > 0) updateQuery += ', ';
            updateQuery += 'image_url = @image_url';
            params.push({ name: 'image_url', type: sql.NVarChar(sql.MAX), value: image_url });
        }
        updateQuery += ' WHERE id = @post_id';

        const request = pool.request()
            .input('post_id', sql.Int, postId);

        params.forEach(param => {
            request.input(param.name, param.type, param.value);
        });

        await request.query(updateQuery);
    },

    async delete(postId, userId) {
        const pool = await getPool();

        // Check ownership
        const check = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        if (check.recordset.length === 0) return false;

        // Delete likes and comments first
        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Likes WHERE post_id = @post_id`);

        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Comments WHERE post_id = @post_id`);

        // Delete post
        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Posts WHERE id = @post_id`);

        return true;
    },

    async toggleLike(postId, userId) {
        const pool = await getPool();
        const existing = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Likes WHERE post_id = @post_id AND user_id = @user_id`);

        let liked;
        if (existing.recordset.length > 0) {
            await pool.request()
                .input('post_id', sql.Int, postId)
                .input('user_id', sql.Int, userId)
                .query(`DELETE FROM Likes WHERE post_id = @post_id AND user_id = @user_id`);
            liked = false;
        } else {
            await pool.request()
                .input('post_id', sql.Int, postId)
                .input('user_id', sql.Int, userId)
                .query(`INSERT INTO Likes (post_id, user_id) VALUES (@post_id, @user_id)`);
            liked = true;
        }

        const countResult = await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`SELECT COUNT(*) AS like_count FROM Likes WHERE post_id = @post_id`);

        return { liked, like_count: countResult.recordset[0].like_count };
    },

    async togglePrivacy(postId, userId) {
        const pool = await getPool();

        // Add column if missing
        const columnCheck = await pool.request().query(`
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Posts' AND COLUMN_NAME = 'is_private'
        `);
        if (columnCheck.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE Posts ADD is_private BIT DEFAULT 0`);
        }

        const check = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id, is_private FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        if (check.recordset.length === 0) return null;

        const currentPrivate = check.recordset[0].is_private || 0;
        const newPrivate = currentPrivate ? 0 : 1;

        await pool.request()
            .input('post_id', sql.Int, postId)
            .input('is_private', sql.Bit, newPrivate)
            .query(`UPDATE Posts SET is_private = @is_private WHERE id = @post_id`);

        return newPrivate;
    }
};

module.exports = PostModel;
