import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../database.json');

// Helper: Baca database JSON
function getDB() {
    try {
        const data = readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Jika file belum ada, kembalikan struktur default
        return { users: [], sessions: [], orders: [], deposit_history: [], h2h_transactions: [], broadcast: [] };
    }
}

// Helper: Simpan database JSON
function saveDB(data) {
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper: Generate ID
function generateUserId() {
    return 'USR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    // Set CORS biar aman
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // ==========================================
    // 1. REGISTER
    // ==========================================
    if (route === 'register' && req.method === 'POST') {
        try {
            const { username, email, password } = req.body;
            const db = getDB();

            if (db.users.find(u => u.email === email)) {
                return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
            }

            const newUser = {
                id: generateUserId(),
                username,
                email,
                password: password, // Di production, hash pake bcrypt
                api_key: 'DP-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                balance: 0,
                total_order: 0,
                total_deposit: 0,
                twofa_enabled: 0,
                twofa_secret: null,
                registered_at: new Date().toISOString()
            };

            db.users.push(newUser);
            saveDB(db);

            return res.status(200).json({
                status: 'success',
                message: 'Registrasi berhasil',
                data: { user: { id: newUser.id, username: newUser.username, email: newUser.email } }
            });
        } catch (error) {
            console.error('[Register Error]', error.message);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server (Register)' });
        }
    }

    // ==========================================
    // 2. LOGIN
    // ==========================================
    if (route === 'login' && req.method === 'POST') {
        try {
            const { email, password } = req.body;
            const db = getDB();

            const user = db.users.find(u => u.email === email && u.password === password);
            if (!user) {
                return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
            }

            const token = 'token-' + user.id + '-' + Date.now();

            return res.status(200).json({
                status: 'success',
                data: { token, user: { ...user, password: undefined } }
            });
        } catch (error) {
            console.error('[Login Error]', error.message);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server (Login)' });
        }
    }

    // ==========================================
    // 3. BALANCE
    // ==========================================
    if (route === 'balance' && req.method === 'GET') {
        try {
            const { user_id } = req.query;
            const db = getDB();
            const user = db.users.find(u => u.id === user_id);

            if (!user) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });

            return res.status(200).json({
                status: 'success',
                data: { balance: user.balance }
            });
        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server (Balance)' });
        }
    }

    // ==========================================
    // 4. CHANGE PASSWORD
    // ==========================================
    if (route === 'change_password' && req.method === 'POST') {
        try {
            const { user_id, old_password, new_password } = req.body;
            const db = getDB();
            const userIndex = db.users.findIndex(u => u.id === user_id);

            if (userIndex === -1) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            if (db.users[userIndex].password !== old_password) {
                return res.status(400).json({ status: 'error', message: 'Password lama salah' });
            }

            db.users[userIndex].password = new_password;
            saveDB(db);

            return res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });
        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan pada server (Change Password)' });
        }
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
