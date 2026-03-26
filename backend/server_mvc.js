const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const dbConfig = require('./config/db');

const createApiRouter = require('./routes/apiRouter');
const initChatSocket = require('./socket/chatSocket');

const app = express();
const server = http.createServer(app);

// --- SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: (o, cb) => cb(null, !o || /^https?:\/\/localhost(:\d+)?$/.test(o)),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' }));
app.use(cors({
    origin: (o, cb) => cb(null, !o || /^https?:\/\/localhost(:\d+)?$/.test(o)),
    credentials: true
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const sessionMiddleware = session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
});
app.use(sessionMiddleware);

// Chia sẻ session với Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Serve static files from frontend package
const frontendPublicDir = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPublicDir));

// --- MULTER (upload ảnh) ---
const uploadsDir = path.join(frontendPublicDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '';
        const name = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + ext;
        cb(null, name);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// SOCKET.IO REAL-TIME CHAT
const onlineUsers = new Map();
const userSockets = new Map();

function emitToUser(userId, event, data) {
    const ids = userSockets.get(String(userId));
    if (ids) ids.forEach(sid => io.to(sid).emit(event, data));
}

initChatSocket(io, { sql, dbConfig, onlineUsers, userSockets, emitToUser });

// REST API routes (MVC)
app.use(createApiRouter({ upload, onlineUsers, emitToUser, io }));

// ERROR HANDLERS
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API không tồn tại' });
});

app.use((err, req, res, next) => {
    console.error('Lỗi middleware:', err);
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload quá lớn (tối đa 50MB).' });
    }
    res.status(500).json({
        error: 'Lỗi server: ' + (err && err.message ? err.message : 'Không xác định')
    });
});

// START SERVER
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, async () => {
    console.log(`🚀 Server NewsFeed + Chat đang chạy tại http://localhost:${PORT}`);
    try {
        const pool = await sql.connect(dbConfig);
        if (pool.connected) console.log('Kết nối SQL Server thành công.');

        // Add is_private column if not exists
        await pool.request().query(`
            IF COL_LENGTH('dbo.Users', 'is_private') IS NULL
            BEGIN
                ALTER TABLE dbo.Users ADD is_private BIT DEFAULT 0;
            END
        `);

        // Ensure follows table exists so follow/unfollow works even if DB schema isn't pre-created
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Follows' AND schema_id = SCHEMA_ID('dbo'))
            BEGIN
                CREATE TABLE dbo.Follows (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    follower_id INT FOREIGN KEY REFERENCES dbo.Users(id),
                    following_id INT FOREIGN KEY REFERENCES dbo.Users(id),
                    UNIQUE(follower_id, following_id)
                );
            END
        `);
    } catch (err) {
        console.error('Lỗi Database:', err.message);
    }
});

