import mysql from 'mysql2/promise';
import { dbConfig } from '../config.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = await mysql.createConnection(dbConfig);

    try {
        const [rows] = await db.execute(
            `SELECT * FROM broadcast 
             WHERE is_active = 1 
             AND (expires_at IS NULL OR expires_at > NOW()) 
             ORDER BY created_at DESC`
        );
        await db.end();
        return res.status(200).json({ status: 'success', data: rows });
    } catch (error) {
        await db.end();
        return res.status(500).json({ status: 'error', message: error.message });
    }
}