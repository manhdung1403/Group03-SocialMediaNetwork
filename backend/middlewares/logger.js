/**
 * Logging middleware utilities
 */
const requestLogger = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
};

const errorLogger = (message, error) => {
    console.error(`[ERROR] ${message}:`, error);
};

const infoLogger = (message) => {
    console.log(`[INFO] ${message}`);
};

module.exports = {
    requestLogger,
    errorLogger,
    infoLogger
};
