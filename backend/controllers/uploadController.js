function uploadImage(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        const url = `/uploads/${encodeURIComponent(req.file.filename)}`;
        return res.json({ success: true, url });
    } catch (err) {
        console.error('upload error', err);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { uploadImage };

