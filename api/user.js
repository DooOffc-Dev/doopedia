import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { dbConfig } from '../config.js';

function generateId(prefix = 'USR') {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateApiKey() {
    return 'DP-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = await mysql.createConnection(dbConfig);
    const { route } = req.query;

    // ==========================================
    // 1. REGISTER
    // ==========================================
    if (route === 'register' && req.method === 'POST') {
        const { username, email, password } = req.body;

        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
        }

        const [existingUser] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Username sudah dipakai' });
        }

        const userId = generateId('USR');
        const apiKey = generateApiKey();
        const hashedPassword = hashPassword(password);
        const registeredAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

        await db.execute(
            `INSERT INTO users (id, username, email, password, api_key, balance, total_order, total_deposit, registered_at)
             VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)`,
            [userId, username, email, hashedPassword, apiKey, registeredAt]
        );

        await db.end();
        return res.status(200).json({ status: 'success', message: 'Registrasi berhasil' });
    }

    // ==========================================
    // 2. LOGIN
    // ==========================================
    if (route === 'login' && req.method === 'POST') {
        const { email, password } = req.body;

        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            await db.end();
            return res.status(401).json({ status: 'error', message: 'Email tidak ditemukan' });
        }

        const user = rows[0];
        const hashedInput = hashPassword(password);

        if (user.password !== hashedInput) {
            await db.end();
            return res.status(401).json({ status: 'error', message: 'Password salah' });
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString().replace('T', ' ').substring(0, 19);

        await db.execute(
            'INSERT INTO sessions (token, user_id, email, expires_at) VALUES (?, ?, ?, ?)',
            [token, user.id, user.email, expiresAt]
        );

        delete user.password;

        await db.end();
        return res.status(200).json({
            status: 'success',
            data: { token, user }
        });
    }

    // ==========================================
    // 3. LOGOUT
    // ==========================================
    if (route === 'logout' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            await db.execute('DELETE FROM sessions WHERE token = ?', [token]);
        }
        await db.end();
        return res.status(200).json({ status: 'success', message: 'Logout berhasil' });
    }

    // ==========================================
    // 4. PROFILE
    // ==========================================
    if (route === 'profile' && req.method === 'GET') {
        const { user_id } = req.query;

        const [rows] = await db.execute(
            `SELECT id, username, email, balance, api_key, twofa_enabled, total_order, total_deposit, registered_at, created_at
             FROM users WHERE id = ?`,
            [user_id]
        );

        if (rows.length === 0) {
            await db.end();
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }

        await db.end();
        return res.status(200).json({ status: 'success', data: rows[0] });
    }

    // ==========================================
    // 5. BALANCE
    // ==========================================
    if (route === 'balance' && req.method === 'GET') {
        const { user_id } = req.query;

        const [rows] = await db.execute('SELECT balance FROM users WHERE id = ?', [user_id]);
        if (rows.length === 0) {
            await db.end();
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }

        await db.end();
        return res.status(200).json({ status: 'success', data: { balance: rows[0].balance } });
    }

    // ==========================================
    // 6. CHANGE API KEY
    // ==========================================
    if (route === 'change_api_key' && req.method === 'POST') {
        const { user_id } = req.body;

        const newKey = generateApiKey();
        await db.execute('UPDATE users SET api_key = ? WHERE id = ?', [newKey, user_id]);

        await db.end();
        return res.status(200).json({ status: 'success', data: { api_key: newKey } });
    }

    // ==========================================
    // 7. CHANGE PASSWORD
    // ==========================================
    if (route === 'change_password' && req.method === 'POST') {
        const { user_id, old_password, new_password } = req.body;

        const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [user_id]);
        if (rows.length === 0) {
            await db.end();
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }

        const currentHash = rows[0].password;
        const oldHash = hashPassword(old_password);

        if (currentHash !== oldHash) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Password lama salah' });
        }

        const newHash = hashPassword(new_password);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [newHash, user_id]);

        await db.end();
        return res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });
    }

    await db.end();
    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}