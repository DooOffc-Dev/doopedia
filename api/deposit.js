import mysql from 'mysql2/promise';
import { dbConfig, RUMAHOTP, APP } from '../config.js';

function generateDepositId() {
    return 'DEP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = await mysql.createConnection(dbConfig);
    const { route } = req.query;

    // ==========================================
    // 1. CREATE DEPOSIT (v2)
    // ==========================================
    if (route === 'create' && req.method === 'POST') {
        const { user_id, amount } = req.body;

        if (amount < APP.depositMin) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Minimal deposit Rp 5.000' });
        }

        const url = `${RUMAHOTP.baseUrl}/v2/deposit/create?amount=${amount}&payment_id=qris`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            await db.end();
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal membuat deposit' });
        }

        const depositId = data.data.deposit_id || generateDepositId();
        const qrCode = data.data.qr_code || '';

        await db.execute(
            `INSERT INTO deposit_history (user_id, amount, status, deposit_id, payment_method, provider_used)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, amount, 'pending', depositId, 'qris', 'rumahotp']
        );

        await db.end();
        return res.status(200).json({
            status: 'success',
            data: { deposit_id: depositId, qr_code: qrCode, amount }
        });
    }

    // ==========================================
    // 2. DEPOSIT STATUS (v2)
    // ==========================================
    if (route === 'status' && req.method === 'GET') {
        const { deposit_id } = req.query;

        if (!deposit_id) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'deposit_id wajib diisi' });
        }

        const url = `${RUMAHOTP.baseUrl}/v2/deposit/get_status?deposit_id=${deposit_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            await db.end();
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal cek status deposit' });
        }

        const status = data.data.status || 'pending';

        if (status === 'paid') {
            const [[deposit]] = await db.execute('SELECT user_id, amount FROM deposit_history WHERE deposit_id = ?', [deposit_id]);
            if (deposit) {
                await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [deposit.amount, deposit.user_id]);
                await db.execute('UPDATE users SET total_deposit = total_deposit + ? WHERE id = ?', [deposit.amount, deposit.user_id]);
                await db.execute('UPDATE deposit_history SET status = ? WHERE deposit_id = ?', ['paid', deposit_id]);
            }
        } else if (status === 'expired' || status === 'cancelled') {
            await db.execute('UPDATE deposit_history SET status = ? WHERE deposit_id = ?', [status, deposit_id]);
        }

        await db.end();
        return res.status(200).json({
            status: 'success',
            data: { status, deposit_id }
        });
    }

    // ==========================================
    // 3. CANCEL DEPOSIT
    // ==========================================
    if (route === 'cancel' && req.method === 'POST') {
        const { deposit_id } = req.body;

        if (!deposit_id) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'deposit_id wajib diisi' });
        }

        const [[deposit]] = await db.execute('SELECT status FROM deposit_history WHERE deposit_id = ?', [deposit_id]);
        if (!deposit || deposit.status !== 'pending') {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Deposit tidak bisa dibatalkan' });
        }

        const url = `${RUMAHOTP.baseUrl}/v1/deposit/cancel?deposit_id=${deposit_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            await db.end();
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal membatalkan deposit' });
        }

        await db.execute('UPDATE deposit_history SET status = ? WHERE deposit_id = ?', ['cancelled', deposit_id]);

        await db.end();
        return res.status(200).json({
            status: 'success',
            message: 'Deposit berhasil dibatalkan',
            data: { deposit_id }
        });
    }

    await db.end();
    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}