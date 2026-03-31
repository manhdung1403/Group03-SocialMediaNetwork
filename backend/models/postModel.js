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
        let updateQuery = 'UPDATE Posts SET '; // Khởi tạo câu lệnh
        const params = [];

        // Kiểm tra nếu có caption thì mới thêm vào câu lệnh update
        if (caption !== undefined) {
            updateQuery += 'caption = @caption';
            params.push({ name: 'caption', type: sql.NVarChar, value: caption || null });
        }
        // Kiểm tra nếu có image_url thì thêm vào câu lệnh update
        if (image_url !== undefined) {
            if (params.length > 0) updateQuery += ', '; // Thêm dấu phẩy ngăn cách
            updateQuery += 'image_url = @image_url';
            params.push({ name: 'image_url', type: sql.NVarChar(sql.MAX), value: image_url });
        }
        updateQuery += ' WHERE id = @post_id'; // Lọc theo ID bài viết

        const request = pool.request().input('post_id', sql.Int, postId);
        // Duyệt qua mảng params để gán giá trị vào request tránh SQL Injection
        params.forEach(param => {
            request.input(param.name, param.type, param.value);
        });

        await request.query(updateQuery); // Thực thi
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
        // Lấy tên người thực hiện like để đưa vào thông báo
        const actorResult = await pool.request().input('user_id', sql.Int, userId)
            .query(`SELECT username FROM Users WHERE id = @user_id`);
        const actorName = actorResult.recordset[0]?.username || `User #${userId}`;

        // Lấy ID chủ bài viết để biết gửi thông báo cho ai
        const ownerResult = await pool.request().input('post_id', sql.Int, postId)
            .query(`SELECT user_id FROM Posts WHERE id = @post_id`);
        const postOwnerId = ownerResult.recordset[0]?.user_id || null;

        // Kiểm tra xem user hiện tại đã like bài viết này chưa
        const existing = await pool.request().input('post_id', sql.Int, postId).input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Likes WHERE post_id = @post_id AND user_id = @user_id`);

        let liked;
        if (existing.recordset.length > 0) {
            // Nếu đã like thì xóa bản ghi (Unlike)
            await pool.request().query(`DELETE FROM Likes WHERE post_id = @post_id AND user_id = @user_id`);
            liked = false;
        } else {
            // Nếu chưa like thì thêm bản ghi mới (Like)
            await pool.request().query(`INSERT INTO Likes (post_id, user_id) VALUES (@post_id, @user_id)`);
            liked = true;
        }

        // Đếm tổng số like hiện tại của bài viết
        const countResult = await pool.request().input('post_id', sql.Int, postId)
            .query(`SELECT COUNT(*) AS like_count FROM Likes WHERE post_id = @post_id`);

        return { liked, like_count: countResult.recordset[0].like_count, notify_user_id: postOwnerId, actor_name: actorName };
    },

    async getComments(postId, currentUserId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('current_user_id', sql.Int, currentUserId)
            .query(`
                SELECT
                    c.id,
                    c.post_id,
                    c.user_id,
                    u.username,
                    c.content,
                    c.created_at,
                    ISNULL(cl.like_count, 0) AS likes,
                    CASE WHEN ucl.id IS NULL THEN 0 ELSE 1 END AS liked
                FROM Comments c
                LEFT JOIN Users u ON u.id = c.user_id
                LEFT JOIN (
                    SELECT comment_id, COUNT(*) AS like_count
                    FROM CommentLikes
                    GROUP BY comment_id
                ) cl ON cl.comment_id = c.id
                LEFT JOIN CommentLikes ucl
                    ON ucl.comment_id = c.id AND ucl.user_id = @current_user_id
                WHERE c.post_id = @post_id
                ORDER BY c.created_at ASC
            `);

        return result.recordset;
    },

    async createComment(postId, userId, content) {
        const pool = await getPool();

        const actorResult = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`SELECT username FROM Users WHERE id = @user_id`);
        const actorName = actorResult.recordset[0]?.username || `User #${userId}`;

        const ownerResult = await pool.request()
            .input('post_id', sql.Int, postId)
            .query(`SELECT user_id FROM Posts WHERE id = @post_id`);
        if (ownerResult.recordset.length === 0) return null;
        const postOwnerId = ownerResult.recordset[0].user_id;

        const inserted = await pool.request()
            .input('post_id', sql.Int, postId)
            .input('user_id', sql.Int, userId)
            .input('content', sql.NVarChar(sql.MAX), content)
            .query(`
                INSERT INTO Comments (post_id, user_id, content, created_at)
                OUTPUT INSERTED.id, INSERTED.post_id, INSERTED.user_id, INSERTED.content, INSERTED.created_at
                VALUES (@post_id, @user_id, @content, GETDATE())
            `);

        return {
            comment: inserted.recordset[0],
            notify_user_id: postOwnerId,
            actor_name: actorName
        };
    },

    async deleteComment(commentId, userId) {
        const pool = await getPool();
        // Kiểm tra xem comment có thuộc về userId này không
        const check = await pool.request()
            .input('comment_id', sql.Int, commentId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM Comments WHERE id = @comment_id AND user_id = @user_id`);

        if (check.recordset.length === 0) return false; // Không chính chủ

        // Xóa các lượt like của comment này trước để tránh lỗi ràng buộc dữ liệu
        await pool.request().input('comment_id', sql.Int, commentId)
            .query(`DELETE FROM CommentLikes WHERE comment_id = @comment_id`);

        // Xóa comment chính
        await pool.request().input('comment_id', sql.Int, commentId)
            .query(`DELETE FROM Comments WHERE id = @comment_id`);

        return true;
    },

    async toggleCommentLike(postId, commentId, userId) {
        const pool = await getPool();

        // 1. Lấy UID của chủ comment để gửi thông báo
        const commentResult = await pool.request()
            .input('comment_id', sql.Int, commentId)
            .input('post_id', sql.Int, postId)
            .query(`SELECT id, user_id, content FROM Comments WHERE id = @comment_id AND post_id = @post_id`);
        if (commentResult.recordset.length === 0) return null;
        const commentOwnerId = commentResult.recordset[0].user_id;

        // 2. Lấy tên user thực hiện thả tim
        const actorResult = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`SELECT username FROM Users WHERE id = @user_id`);
        const actorName = actorResult.recordset[0]?.username || `User #${userId}`;

        // 3. Kiểm tra xem User này đã từng thả tim comment này chưa?
        const existing = await pool.request()
            .input('comment_id', sql.Int, commentId)
            .input('user_id', sql.Int, userId)
            .query(`SELECT id FROM CommentLikes WHERE comment_id = @comment_id AND user_id = @user_id`);

        let liked;
        if (existing.recordset.length > 0) {
            // Đã Like -> Unlike (Xóa khỏi DB)
            await pool.request()
                .input('comment_id', sql.Int, commentId)
                .input('user_id', sql.Int, userId)
                .query(`DELETE FROM CommentLikes WHERE comment_id = @comment_id AND user_id = @user_id`);
            liked = false;
        } else {
            // Chưa Like -> Like (Thêm vào DB)
            await pool.request()
                .input('comment_id', sql.Int, commentId)
                .input('user_id', sql.Int, userId)
                .query(`INSERT INTO CommentLikes (comment_id, user_id) VALUES (@comment_id, @user_id)`);
            liked = true;
        }

        const countResult = await pool.request()
            .input('comment_id', sql.Int, commentId)
            .query(`SELECT COUNT(*) AS like_count FROM CommentLikes WHERE comment_id = @comment_id`);

        return {
            liked,
            like_count: countResult.recordset[0].like_count,
            notify_user_id: commentOwnerId,
            actor_name: actorName
        };
    },

    async togglePrivacy(postId, userId) {
        const pool = await getPool(); // Kết nối tới SQL Server

        // Truy vấn kiểm tra sự tồn tại và quyền sở hữu bài viết
        const check = await pool.request()
            .input('post_id', sql.Int, postId) // Truyền tham số ID bài viết
            .input('user_id', sql.Int, userId) // Truyền tham số ID người dùng hiện tại
            .query(`SELECT id, is_private FROM Posts WHERE id = @post_id AND user_id = @user_id`);

        // Nếu không có kết quả, trả về null
        if (check.recordset.length === 0) return null;

        // Lấy giá trị hiện tại (mặc định 0 nếu null) và đảo ngược (0 sang 1, 1 sang 0)
        const currentPrivate = check.recordset[0].is_private || 0;
        const newPrivate = currentPrivate ? 0 : 1;

        // Cập nhật trạng thái mới vào cột is_private của bài viết
        await pool.request()
            .input('post_id', sql.Int, postId)
            .input('is_private', sql.Bit, newPrivate) // Kiểu Bit tương ứng 0/1
            .query(`UPDATE Posts SET is_private = @is_private WHERE id = @post_id`);

        return newPrivate; // Trả về trạng thái mới để Service nhận biết
    }
};

module.exports = PostModel;
