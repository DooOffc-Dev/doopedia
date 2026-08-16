const RUMAHOTP = { baseUrl: 'https://www.rumahotp.io/api', apiKey: 'rk-dev-NS4dTv7DnJNjjKGiOnMjOFjls69upghT' };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { route } = req.query;

    // AMBIL PRODUCT / SERVICES
    if (route === 'product') {
        try {
            const response = await fetch(`${RUMAHOTP.baseUrl}/v1/h2h/product`);
            const data = await response.json();
            return res.status(200).json({ status: 'success', data: data.data });
        } catch (error) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
