/**
 * Helper utilities for common operations
 */

const Helpers = {
    /**
     * Safely parse integer from string
     */
    parseInt(value) {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    },

    /**
     * Generate random string
     */
    generateRandomString(length = 10) {
        return Math.random().toString(36).substring(2, 2 + length);
    },

    /**
     * Format date to YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    /**
     * Get current ISO date string
     */
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Check if user owns resource
     */
    isOwner(resourceUserId, currentUserId) {
        return resourceUserId === currentUserId;
    }
};

module.exports = Helpers;
