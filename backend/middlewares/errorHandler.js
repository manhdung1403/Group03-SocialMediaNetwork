/**
 * Global error handling middleware
 * Catches errors from all routes and sends consistent error responses
 */
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload quá lớn (tối đa 50MB).' });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Lỗi server: không xác định';

    return res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
