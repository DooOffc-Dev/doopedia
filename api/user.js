import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_FILE = path.join(process.cwd(), 'database.json');

// ==========================================
// HELPER
// ==========================================
function readDB() {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

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

// ==========================================
// HANDLER UTAMA
// ==========================================
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // ==========================================
    // TEST
    // ==========================================
    if (route === 'test') {
        return res.status(200).json({
            status: 'success',
            message: 'API hidup dan berjalan! (mode JSON)',
            timestamp: new Date().toISOString()
        });
    }

    // ==========================================
    // REGISTER
    // ==========================================
    if (route === 'register' && req.method === 'POST') {
        const { username, email, password } = req.body;

        const db = readDB();
        const existing = db.users.find(u => u.email === email);
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
        }

        const existingUser = db.users.find(u => u.username === username);
        if (existingUser) {
            return res.status(400).json({ status: 'error', message: 'Username sudah dipakai' });
        }

        const userId = generateId('USR');
        const apiKey = generateApiKey();
        const hashedPassword = hashPassword(password);
        const registeredAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const newUser = {
            id: userId,
            username,
            email,
            password: hashedPassword,
            api_key: apiKey,
            balance: 0,
            total_order: 0,
            total_deposit: 0,
            twofa_enabled: 0,
            twofa_secret: null,
            registered_at: registeredAt
        };

        db.users.push(newUser);
        writeDB(db);

        return res.status(200).json({ status: 'success', message: 'Registrasi berhasil' });
    }

    // ==========================================
    // LOGIN
    // ==========================================
    if (route === 'login' && req.method === 'POST') {
        const { email, password } = req.body;

        const db = readDB();
        const user = db.users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Email tidak ditemukan' });
        }

        if (user.password !== hashPassword(password)) {
            return res.status(401).json({ status: 'error', message: 'Password salah' });
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString().replace('T', ' ').substring(0, 19);

        db.sessions.push({
            token,
            user_id: user.id,
            email: user.email,
            expires_at: expiresAt
        });
        writeDB(db);

        const userData = { ...user };
        delete userData.password;

        return res.status(200).json({
            status: 'success',
            data: { token, user: userData }
        });
    }

    // ==========================================
    // LOGOUT
    // ==========================================
    if (route === 'logout' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            const db = readDB();
            db.sessions = db.sessions.filter(s => s.token !== token);
            writeDB(db);
        }
        return res.status(200).json({ status: 'success', message: 'Logout berhasil' });
    }

    // ==========================================
    // PROFILE
    // ==========================================
    if (route === 'profile' && req.method === 'GET') {
        const { user_id } = req.query;
        const db = readDB();
        const user = db.users.find(u => u.id === user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const userData = { ...user };
        delete userData.password;
        return res.status(200).json({ status: 'success', data: userData });
    }

    // ==========================================
    // BALANCE
    // ==========================================
    if (route === 'balance' && req.method === 'GET') {
        const { user_id } = req.query;
        const db = readDB();
        const user = db.users.find(u => u.id === user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        return res.status(200).json({ status: 'success', data: { balance: user.balance } });
    }

    // ==========================================
    // CHANGE API KEY
    // ==========================================
    if (route === 'change_api_key' && req.method === 'POST') {
        const { user_id } = req.body;
        const db = readDB();
        const userIndex = db.users.findIndex(u => u.id === user_id);
        if (userIndex === -1) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const newKey = generateApiKey();
        db.users[userIndex].api_key = newKey;
        writeDB(db);
        return res.status(200).json({ status: 'success', data: { api_key: newKey } });
    }

    // ==========================================
    // CHANGE PASSWORD
    // ==========================================
    if (route === 'change_password' && req.method === 'POST') {
        const { user_id, old_password, new_password } = req.body;
        const db = readDB();
        const userIndex = db.users.findIndex(u => u.id === user_id);
        if (userIndex === -1) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const currentHash = db.users[userIndex].password;
        if (currentHash !== hashPassword(old_password)) {
            return res.status(400).json({ status: 'error', message: 'Password lama salah' });
        }
        db.users[userIndex].password = hashPassword(new_password);
        writeDB(db);
        return res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}=