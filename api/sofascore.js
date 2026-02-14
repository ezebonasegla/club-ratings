/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Usa ScrapingBee para bypass de protecciones anti-bot
 * ScrapingBee FREE: 1,000 requests/mes permanente
 */

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;

  try {
    let data;

    if (scrapingBeeKey && scrapingBeeKey !== 'your_scrapingbee_api_key_here') {
      // Usar ScrapingBee (1000 requests/mes GRATIS permanente)
      console.log('Using ScrapingBee...');
      const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(url)}`;
      
      const response = await fetch(scrapingBeeUrl, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ScrapingBee error ${response.status}:`, errorText);
        throw new Error(`ScrapingBee responded with status ${response.status}`);
      }

      // ScrapingBee devuelve el contenido directamente
      data = await response.json();
    } else {
      // Fallback - intento directo (probablemente falle)
      console.log('ScrapingBee not configured, trying direct access...');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Direct access error ${response.status}:`, errorText);
        throw new Error(`Sofascore blocked request (${response.status}). Register at https://www.scrapingbee.com for FREE 1000 requests/month`);
      }

      data = await response.json();
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message,
      hint: 'Register FREE at https://www.scrapingbee.com (1000 requests/month forever)'
    });
  }
}
