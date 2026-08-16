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
            // Wajib kasih search minimal biar API mau ngasih data.
            // Di sini gua pake search='a' (huruf apa aja gapapa)
            const url = `${RUMAHOTP.baseUrl}/v2/services?search=a`;
            console.log('[Proxy] Fetching from:', url);

            const response = await fetch(url, { 
                headers: { 'x-apikey': RUMAHOTP.apiKey } 
            });

            // Cek dulu status response API-nya
            if (!response.ok) {
                const textErr = await response.text();
                return res.status(response.status).json({ 
                    status: 'error', 
                    message: `API RumahOTP Error ${response.status}: ${textErr}` 
                });
            }

            const data = await response.json();

            // Pastiin data balikan bukan null/undefined
            if (!data || !data.data) {
                return res.status(200).json({ status: 'success', data: [] });
            }

            return res.status(200).json({ status: 'success', data: data.data });

        } catch (error) {
            console.error('[Proxy Error]', error.message);
            return res.status(500).json({ status: 'error', message: error.message });
        }
    }

    return res.status(400).json({ status: 'error', message: 'Route tidak valid' });
}
