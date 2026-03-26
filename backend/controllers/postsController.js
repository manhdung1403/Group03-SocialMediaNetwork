const sql = require('mssql');
const { getPool } = require('../models/db');

async function debugPosts(req, res) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('currentUserId', sql.Int, req.session.userId)
            .query(`
                SELECT 
                    p.id, 
                    p.image_url, 
                    p.caption, 
                    p.created_at, 
                    u.id AS user_id, 
                    u.username,
                    ISNULL(lc.like_count, 0) AS like_count,
                    ISNULL(cc.comment_count, 0) AS comment_count,
                    CASE WHEN ul.user_id IS NULL THEN 0 ELSE 1 END AS liked_by_current_user
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
                ORDER BY p.created_at DESC
            `);

        console.log('DEBUG POSTS:', JSON.stringify(result.recordset, null, 2));
        return res.json(result.recordset);
    } catch (err) {
        console.error('Debug error:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function getPosts(req, res) {
    try {
        const pool = await getPool();

        // Kiểm tra nếu trường is_private có tồn tại, để hỗ trợ bản DB cũ
        const columnCheck = await pool.request().query(`
            SELECT 1 AS has_column
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Posts' AND COLUMN_NAME = 'is_private'
        `);
        const hasIsPrivate = columnCheck.recordset.length > 0;

        const isPrivateSelect = hasIsPrivate ? 'p.is_private,' : '0 AS is_private,';
        const isPrivateFilter = hasIsPrivate ? '(ISNULL(p.is_private, 0) = 0 OR p.user_id = @currentUserId)' : '1=1';

        const result = await pool.request()
            .input('currentUserId', sql.Int, req.session.userId)
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

        return res.json(result.recordset);
    } catch (err) {
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function createPost(req, res) {
    try {
        const { image_url, caption } = req.body;
        const userId = req.session.userId;

        if (!image_url) {
            return res.status(400).json({ error: 'URL ảnh là bắt buộc' });
        }

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

        return res.json({ success: true, message: 'Bài đăng đã được tạo thành công', post: result.recordset[0] });
    } catch (err) {
        console.error('Lỗi tạo bài đăng:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function updatePost(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);
        const { caption, image_url } = req.body;
        const userId = req.session.userId;

        if (isNaN(postId)) return res.status(400).json({ error: 'ID bài viết không hợp lệ' });

        const pool = await getPool();
        const check = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        if (check.recordset.length === 0) {
            return res.status(403).json({ error: 'Không có quyền sửa bài viết này hoặc bài viết không tồn tại' });
        }

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

        return res.json({ success: true, message: 'Cập nhật thành công' });
    } catch (err) {
        console.error('Lỗi sửa bài đăng:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function toggleLike(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.session.userId;

        if (isNaN(postId)) return res.status(400).json({ error: 'ID bài viết không hợp lệ' });

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

        return res.json({ success: true, liked, like_count: countResult.recordset[0].like_count });
    } catch (err) {
        console.error('Lỗi toggle tim:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function togglePostPrivacy(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.session.userId;

        if (isNaN(postId)) return res.status(400).json({ error: 'ID bài viết không hợp lệ' });

        const pool = await getPool();

        // Tự add cột is_private nếu chưa có (hỗ trợ db cũ)
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

        if (check.recordset.length === 0) {
            return res.status(403).json({ error: 'Không có quyền sửa bài viết này hoặc bài viết không tồn tại' });
        }

        const currentPrivate = check.recordset[0].is_private || 0;
        const newPrivate = currentPrivate ? 0 : 1;

        await pool.request()
            .input('post_id', sql.Int, postId)
            .input('is_private', sql.Bit, newPrivate)
            .query(`UPDATE Posts SET is_private = @is_private WHERE id = @post_id`);

        return res.json({ success: true, message: 'Cập nhật chế độ riêng tư thành công', is_private: newPrivate });
    } catch (err) {
        console.error('Lỗi toggle privacy bài đăng:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function deletePost(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);
        const userId = req.session.userId;

        if (isNaN(postId)) return res.status(400).json({ error: 'ID bài viết không hợp lệ' });

        const pool = await getPool();
        const check = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        if (check.recordset.length === 0) {
            return res.status(403).json({ error: 'Không có quyền xóa bài viết này hoặc bài viết không tồn tại' });
        }

        // Xóa likes và comments trước khi xóa post
        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Likes WHERE post_id = @post_id`);

        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Comments WHERE post_id = @post_id`);

        await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`DELETE FROM Posts WHERE id = @post_id`);

        return res.json({ success: true, message: 'Xóa bài viết thành công' });
    } catch (err) {
        console.error('Lỗi xóa bài đăng:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

module.exports = {
    debugPosts,
    getPosts,
    createPost,
    updatePost,
    togglePostPrivacy,
    deletePost,
    toggleLike
};

