const sql = require('mssql');
const { getPool } = require('./db');

const MessageModel = {
    async getMessagesBetween(senderId, receiverId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('sId', sql.Int, senderId)
            .input('rId', sql.Int, receiverId)
            .query(`SELECT * FROM Messages 
                WHERE (sender_id = @sId AND receiver_id = @rId) 
                OR (sender_id = @rId AND receiver_id = @sId) 
                ORDER BY created_at ASC`);
        return result.recordset;
    },

    async listConversations(userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT c.id, c.title, c.last_message, c.last_updated, c.is_group,
                    oa.other_id, oa.other_name, oa.other_last_seen
                FROM Conversations c
                OUTER APPLY (
                    SELECT TOP 1
                        u.id as other_id,
                        u.username as other_name,
                        u.last_seen as other_last_seen
                    FROM ConversationParticipants cp2
                    JOIN Users u ON u.id = cp2.user_id
                    WHERE cp2.conversation_id = c.id
                      AND cp2.user_id <> @userId
                    ORDER BY u.id
                ) oa
                WHERE c.id IN (SELECT conversation_id FROM ConversationParticipants WHERE user_id = @userId)
                ORDER BY c.last_updated DESC
            `);
        return result.recordset;
    },

    async getUnreadCount(userId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT COUNT(1) AS unread_count
                FROM Messages m
                WHERE m.conversation_id IS NOT NULL
                  AND m.seen = 0
                  AND m.sender_id <> @userId
                  AND m.conversation_id IN (
                      SELECT conversation_id
                      FROM ConversationParticipants
                      WHERE user_id = @userId
                  )
            `);
        return result.recordset[0]?.unread_count || 0;
    },

    async markRead(convId, userId) {
        const pool = await getPool();

        // Check permission
        const check = await pool.request()
            .input('convId', sql.Int, convId)
            .input('userId', sql.Int, userId)
            .query(`SELECT 1 FROM ConversationParticipants WHERE conversation_id = @convId AND user_id = @userId`);

        if (check.recordset.length === 0) return false;

        await pool.request()
            .input('convId', sql.Int, convId)
            .input('userId', sql.Int, userId)
            .query(`UPDATE Messages SET seen = 1, seen_at = GETDATE() WHERE conversation_id = @convId AND sender_id <> @userId`);

        return true;
    },

    async getConversationMessages(convId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('convId', sql.Int, convId)
            .query(`
                SELECT 
                    m.id, m.sender_id, m.receiver_id, m.message_text as text,
                    m.image_url, m.created_at, m.seen, m.reaction,
                    rm.id as reply_to_id,
                    rm.sender_id as reply_sender_id,
                    rm.message_text as reply_text
                FROM Messages m
                LEFT JOIN Messages rm ON m.reply_to_id = rm.id
                WHERE m.conversation_id = @convId
                ORDER BY m.created_at ASC
            `);

        return result.recordset.map(m => ({
            ...m,
            reply_to: m.reply_to_id ? {
                id: m.reply_to_id,
                sender_id: m.reply_sender_id,
                text: m.reply_text
            } : null
        }));
    },

    async createConversation(title, isGroup, userIds) {
        const pool = await getPool();
        const groupFlag = isGroup ? 1 : 0;

        // Check if conversation already exists
        const count = userIds.length;
        const idsList = userIds.join(',');
        const checkQuery = `
            SELECT cp.conversation_id
            FROM ConversationParticipants cp
            JOIN Conversations c ON c.id = cp.conversation_id
            WHERE cp.user_id IN (${idsList})
              AND c.is_group = ${groupFlag}
            GROUP BY cp.conversation_id
            HAVING COUNT(DISTINCT cp.user_id) = ${count}
            AND (SELECT COUNT(*) FROM ConversationParticipants cp2 WHERE cp2.conversation_id = cp.conversation_id) = ${count}
        `;

        const existing = await pool.request().query(checkQuery);
        if (existing.recordset && existing.recordset.length > 0) {
            return { id: existing.recordset[0].conversation_id, existed: true };
        }

        // Create new conversation
        const insert = await pool.request()
            .input('title', sql.NVarChar, title || null)
            .input('isGroup', sql.Bit, groupFlag)
            .query(`INSERT INTO Conversations (title, is_group) OUTPUT INSERTED.id VALUES (@title, @isGroup)`);

        const convId = insert.recordset[0].id;

        // Add participants
        for (const userId of userIds) {
            await pool.request()
                .input('convId', sql.Int, convId)
                .input('userId', sql.Int, userId)
                .query(`INSERT INTO ConversationParticipants (conversation_id, user_id) VALUES (@convId, @userId)`);
        }

        return { id: convId, existed: false };
    },

    async getParticipants(convId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('convId', sql.Int, convId)
            .query(`
                SELECT u.id, u.username, u.last_seen
                FROM ConversationParticipants cp
                JOIN Users u ON cp.user_id = u.id
                WHERE cp.conversation_id = @convId
            `);
        return result.recordset;
    },

    async deleteConversation(convId, userId) {
        const pool = await getPool();

        // Check permission
        const check = await pool.request()
            .input('convId', sql.Int, convId)
            .input('userId', sql.Int, userId)
            .query(`SELECT 1 FROM ConversationParticipants WHERE conversation_id = @convId AND user_id = @userId`);

        if (check.recordset.length === 0) return false;

        // Delete messages
        await pool.request().input('convId', sql.Int, convId).query(`DELETE FROM Messages WHERE conversation_id = @convId`);

        // Delete participants
        await pool.request().input('convId', sql.Int, convId).query(`DELETE FROM ConversationParticipants WHERE conversation_id = @convId`);

        // Delete conversation
        await pool.request().input('convId', sql.Int, convId).query(`DELETE FROM Conversations WHERE id = @convId`);

        return true;
    }
};

module.exports = MessageModel;
