const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');

const AuthService = {
    async register(username, email, password, dob) {
        // Validate
        if (!username || !email || !password || !dob) {
            throw { statusCode: 400, message: 'Vui lòng điền đầy đủ thông tin' };
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            throw { statusCode: 400, message: 'Ngày sinh không hợp lệ' };
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (dob > todayStr) {
            throw { statusCode: 400, message: 'Ngày sinh không được sau ngày hiện tại' };
        }

        // Check if email exists
        const emailExists = await UserModel.checkEmailExists(email);
        if (emailExists) {
            throw { statusCode: 400, message: 'Email đã được sử dụng' };
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await UserModel.create(username, email, hashedPassword, dob);

        return newUser;
    },

    async login(email, password) {
        // Validate
        if (!email || !password) {
            throw { statusCode: 400, message: 'Vui lòng điền đầy đủ thông tin' };
        }

        // Find user
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' };
        }

        // Check password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            throw { statusCode: 401, message: 'Email hoặc mật khẩu không đúng' };
        }

        return {
            id: user.id,
            username: user.username,
            email: user.email
        };
    },

    async updateLastSeen(userId) {
        await UserModel.updateLastSeen(userId);
    }
};

module.exports = AuthService;
