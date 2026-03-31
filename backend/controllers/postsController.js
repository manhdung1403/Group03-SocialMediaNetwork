const PostService = require('../services/PostService');
const NotificationService = require('../services/notificationService');

module.exports = function createPostsController({ emitToUser }) {
    // Hàm tiện ích: Tổ chức lưu thông báo khi có tương tác (Like, Comment)
    async function saveInteractionNotification(targetUserId, actorId, payload) {
        if (!targetUserId) return; // Nếu không có người nhận thì hủy
        try {
            // Đẩy dữ liệu sang Notification Service để thêm vào Database
            await NotificationService.create({
                userId: targetUserId, // ID chủ bài/chủ comment (Người nhận chuông)
                actorId, // ID người thực hiện tương tác
                type: payload.type, // Phân loại (post_like, comment, comment_like)
                postId: payload.postId || null, // ID bài viết liên quan
                commentId: payload.commentId || null, // ID comment liên quan
                message: payload.message // Nội dung ("A đã thả tim bài viết của bạn")
            });
        } catch (err) {
            console.error('Lỗi lưu thông báo:', err);
        }
    }

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

    // Chức năng: Chỉnh sửa bài viết
    async function updatePost(req, res) {
        try {
            const postId = parseInt(req.params.id, 10);
            // Lấy caption và image_url mới từ dữ liệu JSON do Frontend gửi lên
            const { caption, image_url } = req.body;

            if (isNaN(postId)) {
                return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
            }

            // Truyền xuống Service để xử lý cập nhật bài viết ở DB
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
            const postId = parseInt(req.params.id, 10); // Lấy ID bài viết

            if (isNaN(postId)) {
                return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
            }

            // Gọi Service thực hiện toggle like
            const result = await PostService.toggleLike(postId, req.session.userId);
            
            // Nếu hành động là "Like" thành công, tiến hành lưu thông báo
            if (result.liked && result.notify_user_id) {
                await saveInteractionNotification(result.notify_user_id, req.session.userId, {
                    type: 'post_like',
                    actorName: result.actor_name,
                    postId,
                    message: `${result.actor_name} đã thả tim bài viết của bạn`
                });
            }
            return res.json(result);
        } catch (err) {
            return res.status(500).json({ error: 'Lỗi server: ' + err.message });
        }
    }

    async function getComments(req, res) {
        try {
            const postId = parseInt(req.params.id, 10);
            if (isNaN(postId)) {
                return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
            }
            const comments = await PostService.getComments(postId, req.session.userId);
            return res.json({ success: true, comments });
        } catch (err) {
            console.error('Lỗi lấy bình luận:', err);
            return res.status(500).json({ error: 'Lỗi server: ' + err.message });
        }
    }

    async function createComment(req, res) {
        try {
            const postId = parseInt(req.params.id, 10);
            const content = (req.body.content || '').trim();
            if (isNaN(postId)) {
                return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
            }
            if (!content) {
                return res.status(400).json({ error: 'Nội dung bình luận không được trống' });
            }
            const result = await PostService.createComment(postId, req.session.userId, content);
            if (result.notify_user_id) {
                await saveInteractionNotification(result.notify_user_id, req.session.userId, {
                    type: 'comment',
                    actorName: result.actor_name,
                    postId,
                    message: `${result.actor_name} đã bình luận bài viết của bạn`
                });
            }
            return res.json(result);
        } catch (err) {
            console.error('Lỗi tạo bình luận:', err);
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({ error: err.message || ('Lỗi server: ' + err.message) });
        }
    }

    // Chức năng: Xóa bình luận bài viết
    async function deleteComment(req, res) {
        try {
            const commentId = parseInt(req.params.commentId, 10);
            if (isNaN(commentId)) {
                return res.status(400).json({ error: 'ID bình luận không hợp lệ' });
            }
            // Đi qua PostService gọi xuống Model xóa các likes và comment đó
            const result = await PostService.deleteComment(commentId, req.session.userId);
            return res.json(result);
        } catch (err) {
            console.error('Lỗi xóa bình luận:', err);
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({ error: err.message });
        }
    }

    // Chức năng: Tim comment bài viết (Thả tim / Bỏ tim vào comment)
    async function toggleCommentLike(req, res) {
        try {
            const postId = parseInt(req.params.id, 10);
            const commentId = parseInt(req.params.commentId, 10);
            if (isNaN(postId) || isNaN(commentId)) {
                return res.status(400).json({ error: 'ID không hợp lệ' });
            }
            // Chuyển Service thực thi update thông tin tim của Comment
            const result = await PostService.toggleCommentLike(postId, commentId, req.session.userId);
            
            // Xử lý thông báo: Nếu "Thả tim bình luận mới", logic tương tự như tim bài viết
            if (result.liked && result.notify_user_id) {
                await saveInteractionNotification(result.notify_user_id, req.session.userId, {
                    type: 'comment_like',
                    actorName: result.actor_name,
                    postId,
                    commentId,
                    message: `${result.actor_name} đã thả tim bình luận của bạn`
                });
            }
            return res.json(result);
        } catch (err) {
            console.error('Lỗi tim bình luận:', err);
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({ error: err.message || ('Lỗi server: ' + err.message) });
        }
    }

    async function togglePostPrivacy(req, res) {
        try {
            // Chuyển đổi ID bài viết từ tham số URL thành kiểu số nguyên
            const postId = parseInt(req.params.id, 10);

            // Kiểm tra nếu ID không phải là số thì trả về lỗi 400
            if (isNaN(postId)) {
                return res.status(400).json({ error: 'ID bài viết không hợp lệ' });
            }

            // Gọi Service để xử lý việc đảo ngược trạng thái riêng tư
            const result = await PostService.togglePrivacy(postId, req.session.userId);
            
            // Trả về kết quả JSON cho phía Frontend
            return res.json(result);
        } catch (err) {
            // Nếu có lỗi, lấy mã trạng thái lỗi hoặc mặc định là 500 và trả về thông báo lỗi
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

    return {
        debugPosts,
        getPosts,
        createPost,
        updatePost,
        togglePostPrivacy,
        deletePost,
        toggleLike,
        getComments,
        createComment,
        deleteComment,
        toggleCommentLike
    };
};