const { getPool, sql } = require('../models/db');
const dbConfig = require('../config/db');

module.exports = function initChatSocket(io, { dbConfig, onlineUsers, userSockets, emitToUser }) {
    io.on('connection', (socket) => {
        console.log(`⚡ Kết nối mới: ${socket.id}`);

        socket.on('register', (userId) => {
            socket.userId = userId;
            const k = String(userId);
            onlineUsers.set(k, socket.id);

            if (!userSockets.has(k)) userSockets.set(k, new Set());
            userSockets.get(k).add(socket.id);

            io.emit('user_status', { userId, status: 'online', lastSeen: null });
        });

        socket.on('join', (convId) => {
            if (convId) socket.join(`conversation_${convId}`);
        });

        socket.on('send_message', async (data) => {
            const { senderId, receiverId, text, replyToId, conversationId, imageUrl } = data;
            try {
                const imgParam = (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('data:')) ? null : imageUrl;
                const pool = await getPool();

                // Nếu dùng conversationId mà receiverId null, lấy 1 participant khác làm receiver
                let recvId = receiverId;
                if ((recvId == null || recvId === '') && conversationId) {
                    const pr = await pool.request()
                        .input('convId', sql.Int, conversationId)
                        .input('senderId', sql.Int, senderId)
                        .query(`SELECT TOP 1 user_id FROM ConversationParticipants WHERE conversation_id = @convId AND user_id <> @senderId`);

                    if (pr.recordset && pr.recordset[0]) recvId = pr.recordset[0].user_id;
                }

                const result = await pool.request()
                    .input('senderId', sql.Int, senderId)
                    .input('receiverId', sql.Int, recvId || senderId)
                    .input('text', sql.NVarChar, text || null)
                    .input('replyId', sql.Int, replyToId || null)
                    .input('convId', sql.Int, conversationId || null)
                    .input('img', sql.VarChar, imgParam)
                    .query(`
                    INSERT INTO Messages (conversation_id, sender_id, receiver_id, message_text, reply_to_id, image_url)
                    OUTPUT INSERTED.id, INSERTED.created_at
                    VALUES (@convId, @senderId, @receiverId, @text, @replyId, @img)
                `);

                // If this message is a reply, enrich payload so UI can render quote + jump to target.
                let reply_to = null;
                if (replyToId) {
                    const replyRes = await pool.request()
                        .input('replyId', sql.Int, replyToId)
                        .query(`SELECT id, sender_id, message_text FROM Messages WHERE id = @replyId`);

                    if (replyRes.recordset && replyRes.recordset.length > 0) {
                        const r = replyRes.recordset[0];
                        reply_to = { id: r.id, sender_id: r.sender_id, text: r.message_text };
                    }
                }

                const savedMsg = {
                    ...data,
                    id: result.recordset[0].id,
                    created_at: result.recordset[0].created_at,
                    reply_to
                };

                if (conversationId) {
                    await pool.request()
                        .input('convId', sql.Int, conversationId)
                        .input('text', sql.NVarChar, text || null)
                        .query(`UPDATE Conversations SET last_message = @text, last_updated = GETDATE() WHERE id = @convId`);

                    io.to(`conversation_${conversationId}`).emit('receive_message', savedMsg);

                    const parts = await pool.request()
                        .input('convId', sql.Int, conversationId)
                        .query(`SELECT user_id FROM ConversationParticipants WHERE conversation_id = @convId`);

                    for (const p of (parts.recordset || [])) {
                        if (p.user_id !== senderId) emitToUser(p.user_id, 'unread_badge_update');
                    }
                } else {
                    const receiverSocketId = onlineUsers.get(String(receiverId));
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('receive_message', savedMsg);
                        emitToUser(receiverId, 'unread_badge_update');
                    }
                }

                socket.emit('message_sent', savedMsg);
            } catch (err) {
                console.error('Lỗi chat:', err);
            }
        });

        socket.on('read_message', async (data) => {
            try {
                const pool = await getPool();
                await pool.request()
                    .input('messageId', sql.Int, data.messageId)
                    .query(`UPDATE Messages SET seen = 1, seen_at = GETDATE() WHERE id = @messageId`);

                const senderSocket = onlineUsers.get(String(data.senderId));
                if (senderSocket) io.to(senderSocket).emit('message_seen', { messageId: data.messageId, by: data.receiverId });
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('reaction', async (data) => {
            try {
                const pool = await getPool();
                await pool.request()
                    .input('messageId', sql.Int, data.messageId)
                    .input('emoji', sql.NVarChar, data.emoji)
                    .query(`UPDATE Messages SET reaction = @emoji WHERE id = @messageId`);

                io.emit('reaction', data);
            } catch (err) {
                console.error(err);
            }
        });

        socket.on('disconnect', async () => {
            if (socket.userId) {
                const k = String(socket.userId);
                const set = userSockets.get(k);

                if (set) {
                    set.delete(socket.id);
                    if (set.size === 0) userSockets.delete(k);
                }

                if (onlineUsers.get(k) === socket.id) onlineUsers.delete(k);
                const lastSeenTime = new Date().toISOString();

                try {
                    const pool = await getPool();
                    await pool.request()
                        .input('uid', sql.Int, socket.userId)
                        .query(`UPDATE Users SET last_seen = GETDATE() WHERE id = @uid`);
                } catch (e) {
                    console.error('Lỗi cập nhật last_seen:', e);
                }

                io.emit('user_status', { userId: socket.userId, status: 'offline', lastSeen: lastSeenTime });
            }
        });
    });
};

