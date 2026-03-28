const PostService = require('../services/postService');

async function debugPosts(req, res) {
    try {
        const { sql } = require('../models/db');
        const { getPool } = require('../models/db');
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
        const posts = await PostService.getPosts(req.session.userId);
        return res.json(posts);
    } catch (err) {
        console.error('Lỗi lấy bài đăng:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function createPost(req, res) {
    try {
        const { image_url, caption } = req.body;
        const post = await PostService.createPost(req.session.userId, image_url, caption);
        return res.json({ success: true, message: 'Bài đăng đã được tạo thành công', post });
    } catch (err) {
        console.error('Lỗi tạo bài đăng:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function updatePost(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);
        const { caption, image_url } = req.body;

        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
        }

        const result = await PostService.updatePost(postId, req.session.userId, { caption, image_url });
        return res.json(result);
    } catch (err) {
        console.error('Lỗi sửa bài đăng:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function toggleLike(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);

        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
        }

        const result = await PostService.toggleLike(postId, req.session.userId);
        return res.json(result);
    } catch (err) {
        console.error('Lỗi toggle tim:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function togglePostPrivacy(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);

        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
        }

        const result = await PostService.togglePrivacy(postId, req.session.userId);
        return res.json(result);
    } catch (err) {
        console.error('Lỗi toggle privacy bài đăng:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
    }
}

async function deletePost(req, res) {
    try {
        const postId = parseInt(req.params.id, 10);

        if (isNaN(postId)) {
            return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
        }

        const result = await PostService.deletePost(postId, req.session.userId);
        return res.json(result);
    } catch (err) {
        console.error('Lỗi xóa bài đăng:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ error: err.message });
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

