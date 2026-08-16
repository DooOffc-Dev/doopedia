import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const dbPath = path.resolve('./database.json');
const RUMAHOTP = { baseUrl: 'https://www.rumahotp.io/api', apiKey: 'rk-dev-NS4dTv7DnJNjjKGiOnMjOFjls69upghT' };

function getDB() {
    const data = readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

function saveDB(data) {
    writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function generateDepositId() {
    return 'DEP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // CREATE DEPOSIT
    if (route === 'create' && req.method === 'POST') {
        const { user_id, amount } = req.body;
        const db = getDB();

        const url = `${RUMAHOTP.baseUrl}/v2/deposit/create?amount=${amount}&payment_id=qris`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal membuat deposit' });
        }

        const depositId = data.data.deposit_id || generateDepositId();
        const qrCode = data.data.qr_code || '';

        db.deposit_history.push({
            deposit_id: depositId,
            user_id,
            amount,
            status: 'pending',
            payment_method: 'qris',
            provider_used: 'rumahotp',
            created_at: new Date().toISOString()
        });
        saveDB(db);

        return res.status(200).json({
            status: 'success',
            data: { deposit_id: depositId, qr_code: qrCode, amount }
        });
    }

    // STATUS DEPOSIT (V2)
    if (route === 'status' && req.method === 'GET') {
        const { deposit_id } = req.query;
        const db = getDB();

        const url = `${RUMAHOTP.baseUrl}/v2/deposit/get_status?deposit_id=${deposit_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal cek status deposit' });
        }

        const status = data.data.status || 'pending';

        const depositIndex = db.deposit_history.findIndex(d => d.deposit_id === deposit_id);
        if (depositIndex !== -1) {
            db.deposit_history[depositIndex].status = status;
            saveDB(db);

            if (status === 'paid') {
                const userIndex = db.users.findIndex(u => u.id === db.deposit_history[depositIndex].user_id);
                if (userIndex !== -1) {
                    db.users[userIndex].balance += db.deposit_history[depositIndex].amount;
                    db.users[userIndex].total_deposit += db.deposit_history[depositIndex].amount;
                    saveDB(db);
                }
            }
        }

        return res.status(200).json({
            status: 'success',
            data: { status, deposit_id }
        });
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
