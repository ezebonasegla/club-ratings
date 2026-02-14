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

  const scraperApiKey = process.env.SCRAPER_API_KEY;

  try {
    let data;

    if (scraperApiKey && scraperApiKey !== 'your_scraper_api_key_here') {
      // Opción A: Usar ScraperAPI (recomendado)
      console.log('Using ScraperAPI...');
      const scraperUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`;
      
      const response = await fetch(scraperUrl, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ScraperAPI error ${response.status}:`, errorText);
        throw new Error(`ScraperAPI responded with status ${response.status}`);
      }

      data = await response.json();
    } else {
      // Opción B: Fallback - intento directo con headers mejorados
      console.log('ScraperAPI not configured, trying direct access...');
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Direct access error ${response.status}:`, errorText);
        throw new Error(`Sofascore blocked request (${response.status}). Consider using ScraperAPI - register at https://www.scraperapi.com`);
      }

      data = await response.json();
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message,
      hint: 'Register at https://www.scraperapi.com for free API key (1000 requests/month)'
    });
  }
}
