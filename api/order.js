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

function generateOrderId() {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // ORDER
    if (route === 'order' && req.method === 'POST') {
        const { user_id, service_id, provider_id, operator_id, service_name, country, price } = req.body;
        const db = getDB();

        const user = db.users.find(u => u.id === user_id);
        if (!user || user.balance < price) {
            return res.status(400).json({ status: 'error', message: 'Saldo tidak mencukupi' });
        }

        const url = `${RUMAHOTP.baseUrl}/v2/orders?number_id=${service_id}&provider_id=${provider_id}&operator_id=${operator_id}`;
        const response = await fetch(url, { headers: { 'x-apikey': RUMAHOTP.apiKey, 'Accept': 'application/json' } });
        const data = await response.json();

        if (!data.success) {
            return res.status(400).json({ status: 'error', message: data.error?.message || data.message || 'Gagal order' });
        }

        const orderId = data.data.order_id || generateOrderId();
        const phone = data.data.phone || '08888888888';
        const actualPrice = data.data.price || price;

        user.balance -= actualPrice;
        user.total_order += 1;

        db.orders.push({
            id: orderId,
            user_id,
            service_id,
            service_name,
            country,
            provider_id,
            operator_id,
            phone,
            price: actualPrice,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        saveDB(db);

        return res.status(200).json({
            status: 'success',
            data: { order_id: orderId, phone, price: actualPrice }
        });
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
