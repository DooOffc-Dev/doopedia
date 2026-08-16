import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const dbPath = path.resolve('./database.json');

function getDB() {
    const data = readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

function saveDB(data) {
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function generateUserId() {
    return 'USR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateApiKey() {
    return 'DP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // REGISTER
    if (route === 'register' && req.method === 'POST') {
        const { username, email, password } = req.body;
        const db = getDB();

        if (db.users.find(u => u.email === email)) {
            return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
        }

        const newUser = {
            id: generateUserId(),
            username,
            email,
            password, // Note: Simpan dalam bentuk hash (bcrypt) untuk production!
            api_key: generateApiKey(),
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
    }

    // LOGIN
    if (route === 'login' && req.method === 'POST') {
        const { email, password } = req.body;
        const db = getDB();

        const user = db.users.find(u => u.email === email && u.password === password);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Email atau password salah' });
        }

        // Generate token simple (seharusnya JWT untuk production)
        const token = 'token-' + user.id + '-' + Date.now();

        return res.status(200).json({
            status: 'success',
            data: { token, user: { ...user, password: undefined } }
        });
    }

    // BALANCE
    if (route === 'balance' && req.method === 'GET') {
        const { user_id } = req.query;
        const db = getDB();
        const user = db.users.find(u => u.id === user_id);

        if (!user) return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });

        return res.status(200).json({
            status: 'success',
            data: { balance: user.balance }
        });
    }

    // CHANGE PASSWORD
    if (route === 'change_password' && req.method === 'POST') {
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
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
