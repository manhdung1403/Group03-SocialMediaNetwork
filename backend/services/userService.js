const UserModel = require('../models/userModel');

const UserService = {
    async getProfile(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw { statusCode: 404, message: 'Không tìm thấy user' };
        }
        return user;
    },

    async updateProfile(userId, { username, email, bio, dob, avatar, is_private }) {
        // Validate
        if (!username || !email) {
            throw { statusCode: 400, message: 'Username và Email không được để trống' };
        }

        if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            throw { statusCode: 400, message: 'Định dạng ngày sinh không hợp lệ' };
        }

        // Check if email is unique
        const emailExists = await UserModel.checkEmailExists(email, userId);
        if (emailExists) {
            throw { statusCode: 400, message: 'Email đã được sử dụng' };
        }

        // Update user
        const updatedUser = await UserModel.update(userId, {
            username,
            email,
            bio,
            dob,
            avatar,
            is_private
        });

        return updatedUser;
    },

    async updatePrivacy(userId, is_private) {
        // Chuyển tiếp yêu cầu cập nhật xuống Model
        await UserModel.updatePrivacy(userId, is_private);
        // Trả về trạng thái đã cập nhật
        return { is_private };
    },

    async listUsers(currentUserId, search = '') {
        const users = await UserModel.listUsers(currentUserId, search);
        return users;
    },

    async getUserById(currentUserId, targetId) {
        if (isNaN(targetId)) {
            throw { statusCode: 400, message: 'userId không hợp lệ' };
        }

        const user = await UserModel.getUserById(currentUserId, targetId);
        if (!user) {
            throw { statusCode: 404, message: 'Không tìm thấy user' };
        }

        return user;
    }
};

module.exports = UserService;
