import mysql from 'mysql2/promise';
import { dbConfig, RUMAHOTP } from '../config.js';

function generateOrderId() {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = await mysql.createConnection(dbConfig);
    const { route } = req.query;

    // ==========================================
    // 1. ORDER
    // ==========================================
    if (route === 'order' && req.method === 'POST') {
        const { user_id, service_id, provider_id, operator_id, service_name, country, price } = req.body;

        const [[user]] = await db.execute('SELECT balance FROM users WHERE id = ?', [user_id]);
        if (!user || user.balance < price) {
            await db.end();
            return res.status(400).json({ status: 'error', message: 'Saldo tidak mencukupi' });
        }

        const url = `${RUMAHOTP.baseUrl}/v2/orders?number_id=${service_id}&provider_id=${provider_id}&operator_id=${operator_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            await db.end();
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal order' });
        }

        const orderId = data.data.order_id || generateOrderId();
        const phone = data.data.phone || '08888888888';
        const actualPrice = data.data.price || price;

        await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [actualPrice, user_id]);
        await db.execute('UPDATE users SET total_order = total_order + 1 WHERE id = ?', [user_id]);

        await db.execute(
            `INSERT INTO orders (id, user_id, service_id, service_name, country, provider_id, operator_id, phone, price, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, user_id, service_id, service_name, country, provider_id, operator_id, phone, actualPrice, 'pending']
        );

        await db.end();
        return res.status(200).json({
            status: 'success',
            data: { order_id: orderId, phone, price: actualPrice }
        });
    }

    // ==========================================
    // 2. ORDER STATUS
    // ==========================================
    if (route === 'order_status' && req.method === 'GET') {
        const { order_id } = req.query;

        const url = `${RUMAHOTP.baseUrl}/v1/orders/get_status?order_id=${order_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            await db.end();
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal cek status' });
        }

        const otp = data.data.otp_code || null;
        const status = data.data.status || 'pending';

        if (otp) {
            await db.execute('UPDATE orders SET otp_code = ?, status = ? WHERE id = ?', [otp, 'success', order_id]);
        } else if (status === 'cancel' || status === 'failed') {
            const [[order]] = await db.execute('SELECT user_id, price FROM orders WHERE id = ?', [order_id]);
            if (order) {
                await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [order.price, order.user_id]);
                await db.execute('UPDATE orders SET status = ? WHERE id = ?', ['refunded', order_id]);
            }
        }

        await db.end();
        return res.status(200).json({
            status: 'success',
            data: { otp, status }
        });
    }

    // ==========================================
    // 3. SET STATUS
    // ==========================================
    if (route === 'set_status' && req.method === 'POST') {
        const { order_id, status } = req.body;

        await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, order_id]);
        if (status === 'failed' || status === 'cancel') {
            const [[order]] = await db.execute('SELECT user_id, price FROM orders WHERE id = ?', [order_id]);
            if (order) {
                await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [order.price, order.user_id]);
            }
        }

        await db.end();
        return res.status(200).json({ status: 'success', message: 'Status berhasil diubah' });
    }

    await db.end();
    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}