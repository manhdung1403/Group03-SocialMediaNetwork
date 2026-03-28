/**
 * Validation utilities
 */

const Validators = {
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isValidDate(dateStr) {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    },

    isValidInt(value) {
        return !isNaN(parseInt(value, 10));
    },

    isEmpty(value) {
        return !value || (typeof value === 'string' && value.trim() === '');
    }
};

module.exports = Validators;
