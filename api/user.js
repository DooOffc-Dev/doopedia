// ==========================================
// API USER - VERCEL READY (MEMORY-BASED)
// ==========================================

// Data dummy (disimpan di memori)
let mockUsers = [
    {
        id: "USR-1700000000-001",
        username: "admin",
        email: "admin@doopedia.id",
        password: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        api_key: "DP-admin123456",
        balance: 1000000,
        total_order: 0,
        total_deposit: 0,
        twofa_enabled: 0,
        twofa_secret: null,
        registered_at: "2026-01-01 00:00:00",
        created_at: "2026-01-01 00:00:00"
    },
    {
        id: "USR-1700000000-002",
        username: "demo",
        email: "demo@doopedia.id",
        password: "89e01536ac207279409d4de1e5253e01f4a1769e696db0d6062ca9b8f56767c8",
        api_key: "DP-demo123456",
        balance: 50000,
        total_order: 0,
        total_deposit: 0,
        twofa_enabled: 0,
        twofa_secret: null,
        registered_at: "2026-01-01 00:00:00",
        created_at: "2026-01-01 00:00:00"
    }
];

let mockSessions = [];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function generateId(prefix = 'USR') {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function generateApiKey() {
    return 'DP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hashPassword(password) {
    // Simulasi hash sederhana (SHA256 pengganti)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// ==========================================
// MAIN HANDLER
// ==========================================

export default async function handler(req, res) {
    // Set CORS agar frontend bisa akses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { route } = req.query;

    // ==========================================
    // 1. TEST ENDPOINT (untuk cek API hidup)
    // ==========================================
    if (route === 'test') {
        return res.status(200).json({
            status: 'success',
            message: 'API hidup dan berjalan! (Vercel Ready)',
            timestamp: new Date().toISOString()
        });
    }

    // ==========================================
    // 2. REGISTER
    // ==========================================
    if (route === 'register' && req.method === 'POST') {
        const { username, email, password } = req.body;

        // Cek email sudah ada?
        if (mockUsers.find(u => u.email === email)) {
            return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar' });
        }

        // Cek username sudah ada?
        if (mockUsers.find(u => u.username === username)) {
            return res.status(400).json({ status: 'error', message: 'Username sudah dipakai' });
        }

        const userId = generateId('USR');
        const apiKey = generateApiKey();
        const hashedPassword = hashPassword(password);
        const registeredAt = new Date().toISOString();

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
            registered_at: registeredAt,
            created_at: registeredAt
        };

        mockUsers.push(newUser);

        return res.status(200).json({ status: 'success', message: 'Registrasi berhasil' });
    }

    // ==========================================
    // 3. LOGIN
    // ==========================================
    if (route === 'login' && req.method === 'POST') {
        const { email, password } = req.body;

        const user = mockUsers.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Email tidak ditemukan' });
        }

        // Verifikasi password (hash)
        if (user.password !== hashPassword(password)) {
            return res.status(401).json({ status: 'error', message: 'Password salah' });
        }

        // Generate token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Simpan session
        mockSessions.push({
            token,
            user_id: user.id,
            email: user.email,
            expires_at: expiresAt
        });

        // Hapus password sebelum dikirim ke frontend
        const userData = { ...user };
        delete userData.password;

        return res.status(200).json({
            status: 'success',
            data: { token, user: userData }
        });
    }

    // ==========================================
    // 4. LOGOUT
    // ==========================================
    if (route === 'logout' && req.method === 'POST') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            mockSessions = mockSessions.filter(s => s.token !== token);
        }
        return res.status(200).json({ status: 'success', message: 'Logout berhasil' });
    }

    // ==========================================
    // 5. PROFILE
    // ==========================================
    if (route === 'profile' && req.method === 'GET') {
        const { user_id } = req.query;
        const user = mockUsers.find(u => u.id === user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const userData = { ...user };
        delete userData.password;
        return res.status(200).json({ status: 'success', data: userData });
    }

    // ==========================================
    // 6. BALANCE
    // ==========================================
    if (route === 'balance' && req.method === 'GET') {
        const { user_id } = req.query;
        const user = mockUsers.find(u => u.id === user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        return res.status(200).json({ status: 'success', data: { balance: user.balance } });
    }

    // ==========================================
    // 7. CHANGE API KEY
    // ==========================================
    if (route === 'change_api_key' && req.method === 'POST') {
        const { user_id } = req.body;
        const userIndex = mockUsers.findIndex(u => u.id === user_id);
        if (userIndex === -1) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        mockUsers[userIndex].api_key = generateApiKey();
        return res.status(200).json({
            status: 'success',
            data: { api_key: mockUsers[userIndex].api_key }
        });
    }

    // ==========================================
    // 8. CHANGE PASSWORD
    // ==========================================
    if (route === 'change_password' && req.method === 'POST') {
        const { user_id, old_password, new_password } = req.body;
        const userIndex = mockUsers.findIndex(u => u.id === user_id);
        if (userIndex === -1) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const currentHash = mockUsers[userIndex].password;
        if (currentHash !== hashPassword(old_password)) {
            return res.status(400).json({ status: 'error', message: 'Password lama salah' });
        }
        mockUsers[userIndex].password = hashPassword(new_password);
        return res.status(200).json({ status: 'success', message: 'Password berhasil diubah' });
    }

    // ==========================================
    // 9. VERIFY SESSION
    // ==========================================
    if (route === 'verify' && req.method === 'GET') {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ status: 'error', message: 'Token tidak ditemukan' });
        }
        const session = mockSessions.find(s => s.token === token && new Date(s.expires_at) > new Date());
        if (!session) {
            return res.status(401).json({ status: 'error', message: 'Token invalid atau expired' });
        }
        const user = mockUsers.find(u => u.id === session.user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        const userData = { ...user };
        delete userData.password;
        return res.status(200).json({ status: 'success', data: { user: userData } });
    }

    // ==========================================
    // 10. DEFAULT ROUTE
    // ==========================================
    return res.status(400).json({
        status: 'error',
        message: 'Route tidak valid: ' + route
    });
}
