const sql = require('mssql');
const { getPool } = require('./db');

async function ensureNotificationsTable() {
    const pool = await getPool();
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
}

const NotificationModel = {
    async create({ userId, actorId, type, postId = null, commentId = null, message }) {
        await ensureNotificationsTable();
        const pool = await getPool();
        await pool.request()
            .input('user_id', sql.Int, userId)
            .input('actor_id', sql.Int, actorId)
            .input('type', sql.NVarChar(50), type)
            .input('post_id', sql.Int, postId)
            .input('comment_id', sql.Int, commentId)
            .input('message', sql.NVarChar(sql.MAX), message)
            .query(`
                INSERT INTO Notifications (user_id, actor_id, type, post_id, comment_id, message, is_read, created_at)
                VALUES (@user_id, @actor_id, @type, @post_id, @comment_id, @message, 0, GETDATE())
            `);
    },

    async getByUserId(userId) {
        await ensureNotificationsTable();
        const pool = await getPool();
        const result = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`
                SELECT TOP 50
                    n.id,
                    n.user_id,
                    n.actor_id,
                    n.type,
                    n.post_id,
                    n.comment_id,
                    n.message,
                    n.is_read,
                    n.created_at,
                    u.username AS actor_name
                FROM Notifications n
                LEFT JOIN Users u ON u.id = n.actor_id
                WHERE n.user_id = @user_id
                ORDER BY n.created_at DESC
            `);
        return result.recordset;
    },

    async markAllRead(userId) {
        await ensureNotificationsTable();
        const pool = await getPool();
        await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`UPDATE Notifications SET is_read = 1 WHERE user_id = @user_id AND is_read = 0`);
    }
};

module.exports = NotificationModel;
