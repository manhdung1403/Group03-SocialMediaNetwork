const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

module.exports = function createUploadRoutes({ upload }) {
    router.post('/api/upload-image', requireAuth, upload.single('image'), uploadController.uploadImage);
    return router;
};
