import mysql from 'mysql2/promise';
import { dbConfig, RUMAHOTP } from '../config.js';

function generateTransactionId() {
    return 'TRX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = await mysql.createConnection(dbConfig);
    const { route } = req.query;

    // ==========================================
    // 1. PRODUCT LIST (H2H)
    // ==========================================
    if (route === 'product' && req.method === 'GET') {
        try {
            const response = await fetch(`${RUMAHOTP.baseUrl}/v1/h2h/product`);
            const data = await response.json();
            await db.end();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 2. CHECK REKENING
    // ==========================================
    if (route === 'check_rekening' && req.method === 'GET') {
        const { bank_code, account_number } = req.query;

        if (!bank_code || !account_number) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'bank_code dan account_number wajib diisi' });
        }

        try {
            const url = `${RUMAHOTP.baseUrl}/v1/h2h/check/rekening?bank_code=${bank_code}&account_number=${account_number}`;
            const response = await fetch(url);
            const data = await response.json();
            await db.end();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 3. LIST REKENING (Bank/Ewallet)
    // ==========================================
    if (route === 'list_rekening' && req.method === 'GET') {
        try {
            const response = await fetch(`${RUMAHOTP.baseUrl}/v1/h2h/list/rekening`);
            const data = await response.json();
            await db.end();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 4. CHECK GAME ACCOUNT
    // ==========================================
    if (route === 'check_game' && req.method === 'GET') {
        const { account_code, account_number } = req.query;

        if (!account_code || !account_number) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'account_code dan account_number wajib diisi' });
        }

        try {
            const url = `${RUMAHOTP.baseUrl}/v1/h2h/check/username?account_code=${account_code}&account_number=${account_number}`;
            const response = await fetch(url);
            const data = await response.json();
            await db.end();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 5. LIST GAME (Daftar Game/Layanan)
    // ==========================================
    if (route === 'list_game' && req.method === 'GET') {
        try {
            const response = await fetch(`${RUMAHOTP.baseUrl}/v1/h2h/list/username`);
            const data = await response.json();
            await db.end();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 6. TRANSAKSI CREATE (H2H)
    // ==========================================
    if (route === 'transaksi_create' && req.method === 'POST') {
        const { user_id, target, id_code, product_name, price } = req.body;

        if (!user_id || !target || !id_code || !price) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'user_id, target, id_code, dan price wajib diisi' });
        }

        const [[user]] = await db.execute('SELECT balance FROM users WHERE id = ?', [user_id]);
        if (!user) {
            await db.end();
            return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
        }
        if (user.balance < price) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Saldo tidak mencukupi' });
        }

        try {
            const url = `${RUMAHOTP.baseUrl}/v1/h2h/transaksi/create?target=${encodeURIComponent(target)}&id=${id_code}`;
            const response = await fetch(url, {
                headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' }
            });
            const data = await response.json();

            if (!data.success) {
                await db.end();
                return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal melakukan transaksi' });
            }

            const transactionId = data.data.transaksi_id || generateTransactionId();
            const actualPrice = data.data.price || price;

            await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [actualPrice, user_id]);

            await db.execute(
                `INSERT INTO h2h_transactions (id, user_id, target, id_code, product_name, price, status, provider_used)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'rumahotp')`,
                [transactionId, user_id, target, id_code, product_name, actualPrice, 'pending']
            );

            await db.end();
            return res.status(200).json({
                status: 'success',
                data: { transaction_id: transactionId, price: actualPrice, target, id_code }
            });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    // ==========================================
    // 7. TRANSAKSI STATUS (H2H)
    // ==========================================
    if (route === 'transaksi_status' && req.method === 'GET') {
        const { transaksi_id } = req.query;

        if (!transaksi_id) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'transaksi_id wajib diisi' });
        }

        try {
            const url = `${RUMAHOTP.baseUrl}/v1/h2h/transaksi/status?transaksi_id=${transaksi_id}`;
            const response = await fetch(url, {
                headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' }
            });
            const data = await response.json();

            if (!data.success) {
                await db.end();
                return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal cek status transaksi' });
            }

            const status = data.data.status || 'pending';
            const sn = data.data.sn || null;
            const price = data.data.price || 0;

            if (status === 'success') {
                await db.execute('UPDATE h2h_transactions SET status = ?, sn = ? WHERE id = ?', ['success', sn, transaksi_id]);
            } else if (status === 'failed' || status === 'cancel') {
                const [[transaction]] = await db.execute('SELECT user_id, price FROM h2h_transactions WHERE id = ?', [transaksi_id]);
                if (transaction) {
                    await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [transaction.price, transaction.user_id]);
                    await db.execute('UPDATE h2h_transactions SET status = ? WHERE id = ?', ['refunded', transaksi_id]);
                }
            } else {
                await db.execute('UPDATE h2h_transactions SET status = ? WHERE id = ?', [status, transaksi_id]);
            }

            await db.end();
            return res.status(200).json({
                status: 'success',
                data: { transaksi_id, status, sn, price }
            });
        } catch (error) {
            await db.end();
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    await db.end();
    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}