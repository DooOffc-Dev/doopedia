const RUMAHOTP = { baseUrl: 'https://www.rumahotp.io/api', apiKey: 'rk-dev-NS4dTv7DnJNjjKGiOnMjOFjls69upghT' };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // AMBIL SERVICES (APLIKASI) DARI RUMAHOTP
    if (route === 'services') {
        try {
            // Gunakan endpoint v2/services untuk mendapatkan gambar & nama aplikasi
            const response = await fetch(`${RUMAHOTP.baseUrl}/v2/services`, { 
                headers: { 'x-apikey': RUMAHOTP.apiKey } 
            });
            const data = await response.json();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
