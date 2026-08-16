import { readFileSync } from 'fs';
import path from 'path';

const dbPath = path.resolve('./database.json');

function getDB() {
    const data = readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = getDB();
    const now = new Date();

    const activeBroadcasts = db.broadcast.filter(b => 
        b.is_active === 1 && 
        (!b.expires_at || new Date(b.expires_at) > now)
    );

    return res.status(200).json({ status: 'success', data: activeBroadcasts });
}
