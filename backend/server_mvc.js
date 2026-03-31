const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import config
const dbConfig = require('./config/db');

// Import routes
const createApiRouter = require('./routes/apiRouter');

// Import socket
const initChatSocket = require('./socket/chatSocket');

// Import middlewares
const errorHandler = require('./middlewares/errorHandler');
const { requestLogger } = require('./middlewares/logger');

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
app.use(requestLogger);
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

// Share session with Socket.IO
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

initChatSocket(io, { dbConfig, onlineUsers, userSockets, emitToUser });

// REST API routes (MVC)
app.use(createApiRouter({ upload, onlineUsers, emitToUser, io }));

// Handle 404 for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API không tồn tại' });
});

// Global error handler
app.use(errorHandler);

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

        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Notifications' AND schema_id = SCHEMA_ID('dbo'))
            BEGIN
                CREATE TABLE dbo.Notifications (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    user_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(id),
                    actor_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(id),
                    type NVARCHAR(50) NOT NULL,
                    post_id INT NULL FOREIGN KEY REFERENCES dbo.Posts(id),
                    comment_id INT NULL FOREIGN KEY REFERENCES dbo.Comments(id),
                    message NVARCHAR(MAX) NOT NULL,
                    is_read BIT NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT GETDATE()
                );
            END
        `);
    } catch (err) {
        console.error('Lỗi Database:', err.message);
    }
});

