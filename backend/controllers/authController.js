const bcrypt = require('bcrypt');
const sql = require('mssql');
const dbConfig = require('../config/db');

async function register(req, res) {
    try {
        const { username, email, password, dob } = req.body;

        if (!username || !email || !password || !dob) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            return res.status(400).json({ error: 'Ngày sinh không hợp lệ' });
        }
        const todayStr = new Date().toISOString().split('T')[0];
        if (dob > todayStr) {
            return res.status(400).json({ error: 'Ngày sinh không được sau ngày hiện tại' });
        }

        const pool = await sql.connect(dbConfig);
        const checkResult = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id FROM Users WHERE email = @email');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, hashedPassword)
            .input('dob', sql.Date, dob)
            .query(`INSERT INTO Users (username, email, password, dob) 
                    OUTPUT INSERTED.id, INSERTED.username, INSERTED.email
                    VALUES (@username, @email, @password, @dob)`);

        const newUser = result.recordset[0];
        req.session.userId = newUser.id;
        req.session.username = newUser.username;
        return res.json({ success: true, message: 'Đăng ký thành công', user: newUser });
    } catch (err) {
        console.error('Lỗi đăng ký:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
        }

        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id, username, email, password FROM Users WHERE email = @email');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        }

        const user = result.recordset[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

        req.session.userId = user.id;
        req.session.username = user.username;
        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (err) {
        console.error('Lỗi đăng nhập:', err);
        return res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
}

async function logout(req, res) {
    const userId = req.session && req.session.userId;
    if (userId) {
        try {
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('uid', sql.Int, userId)
                .query(`UPDATE Users SET last_seen = GETDATE() WHERE id = @uid`);
        } catch (e) {
            console.error('logout last_seen error', e);
        }
    }

    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Lỗi khi đăng xuất' });
        return res.json({ success: true, message: 'Đăng xuất thành công' });
    });
}

function authStatus(req, res) {
    if (req.session && req.session.userId) {
        return res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username } });
    }
    return res.json({ loggedIn: false });
}

module.exports = {
    register,
    login,
    logout,
    authStatus
};

