/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Usa ScraperAPI para bypass de protecciones anti-bot
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

  try {
    // Delay aleatorio para evitar detección de bot
    const delay = Math.floor(Math.random() * 500) + 200;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Array de User-Agents para rotar
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    console.log('Fetching from Sofascore...', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': randomUA,
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://www.sofascore.com/',
        'Origin': 'https://www.sofascore.com',
      },
      redirect: 'follow',
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error(`Sofascore blocked request (${response.status}):`, errorText.substring(0, 200));
      
      // Si es 403, dar mensaje específico
      if (response.status === 403) {
        return res.status(403).json({
          error: 'Sofascore blocked the request',
          message: 'Sofascore API requires paid scraping service. The free 7-day trial of ScraperAPI has likely expired.',
          hint: 'Options: 1) Use manual URL input only, 2) Subscribe to ScraperAPI ($49/mo), 3) Deploy your own Puppeteer scraper'
        });
      }
      
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json();
    console.log('Success! Got data from Sofascore');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message,
      details: 'Sofascore requires advanced scraping. Consider using paid services or manual input only.'
    });
  }
}
