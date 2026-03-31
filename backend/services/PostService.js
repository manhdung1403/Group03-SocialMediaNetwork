const PostModel = require('../models/postModel');

const PostService = {
    async getPosts(currentUserId) {
        return await PostModel.getAll(currentUserId);
    },

    async createPost(userId, image_url, caption) {
        if (!image_url) {
            throw { statusCode: 400, message: 'URL ảnh là bắt buộc' };
        }

        const post = await PostModel.create(userId, image_url, caption);
        return post;
    },

    async updatePost(postId, userId, { caption, image_url }) {
        // Kiểm tra xem user có phải chủ bài viết không
        const exists = await PostModel.findById(postId, userId);
        if (!exists) {
            throw { statusCode: 403, message: 'Không có quyền sửa bài viết này hoặc bài viết không tồn tại' };
        }

        // Tiến hành cập nhật
        await PostModel.update(postId, userId, { caption, image_url });
        return { success: true, message: 'Cập nhật thành công' };
    },

    async deletePost(postId, userId) {
        const deleted = await PostModel.delete(postId, userId);
        if (!deleted) {
            throw { statusCode: 403, message: 'Không có quyền xóa bài viết này hoặc bài viết không tồn tại' };
        }
        return { success: true, message: 'Xóa bài viết thành công' };
    },

    async toggleLike(postId, userId) {
        const result = await PostModel.toggleLike(postId, userId);
        return { success: true, ...result };
    },

    async getComments(postId, userId) {
        const comments = await PostModel.getComments(postId, userId);
        return comments;
    },

    async createComment(postId, userId, content) {
        const result = await PostModel.createComment(postId, userId, content);
        if (!result) {
            throw { statusCode: 404, message: 'Bài viết không tồn tại' };
        }
        return { success: true, ...result };
    },

    async deleteComment(commentId, userId) {
        // Gọi Model để thực hiện xóa sau khi kiểm tra quyền
        const deleted = await PostModel.deleteComment(commentId, userId);
        if (!deleted) {
            // Trả về lỗi nếu không có quyền hoặc không tồn tại
            throw { statusCode: 403, message: 'Không có quyền xóa bình luận này hoặc bình luận không tồn tại' };
        }
        return { success: true, message: 'Xóa bình luận thành công' };
    },

    async toggleCommentLike(postId, commentId, userId) {
        const result = await PostModel.toggleCommentLike(postId, commentId, userId);
        if (!result) {
            throw { statusCode: 404, message: 'Bình luận không tồn tại' };
        }
        return { success: true, ...result };
    },

    async togglePrivacy(postId, userId) {
        // Gọi Model để thực hiện thay đổi trong Database
        const newPrivate = await PostModel.togglePrivacy(postId, userId);
        
        // Nếu Model trả về null (nghĩa là không tìm thấy bài viết hoặc không có quyền)
        if (newPrivate === null) {
            throw { statusCode: 403, message: 'Không có quyền sửa bài viết này hoặc bài viết không tồn tại' };
        }
        
        // Trả về thông báo thành công và trạng thái mới
        return { success: true, message: 'Cập nhật chế độ riêng tư thành công', is_private: newPrivate };
    }
};

module.exports = PostService;
