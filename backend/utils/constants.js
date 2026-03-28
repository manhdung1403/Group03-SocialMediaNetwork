/**
 * Application constants
 */

const Constants = {
    HTTP_STATUS: {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_SERVER_ERROR: 500,
        PAYLOAD_TOO_LARGE: 413
    },

    ERROR_MESSAGES: {
        UNAUTHORIZED: 'Chưa đăng nhập',
        FORBIDDEN: 'Không có quyền',
        NOT_FOUND: 'Không tìm thấy dữ liệu',
        SERVER_ERROR: 'Lỗi server',
        EMAIL_EXISTS: 'Email đã được sử dụng',
        INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng'
    },

    FILE_LIMITS: {
        MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
        MAX_PAYLOAD: 50 * 1024 * 1024   // 50MB
    },

    SESSION: {
        SECRET: 'your-secret-key-change-this-in-production',
        MAX_AGE: 24 * 60 * 60 * 1000    // 24 hours
    }
};

module.exports = Constants;
