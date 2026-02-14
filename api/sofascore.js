/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Sistema de scraping propio con rotating headers y delays
 */

// Pool de User Agents reales
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

// Delay aleatorio para simular comportamiento humano
const randomDelay = (min = 500, max = 1500) => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

// Obtener headers aleatorios
const getRandomHeaders = () => {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': userAgent,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.sofascore.com/',
    'Origin': 'https://www.sofascore.com',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
};

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
      // Opción A: Usar ScraperAPI si está configurado
      console.log('Using ScraperAPI...');
      const scraperUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`;
      
      const response = await fetch(scraperUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`ScraperAPI error: ${response.status}`);
      }

      data = await response.json();
    } else {
      // Opción B: Sistema propio con rotating headers + delays
      console.log('Using custom scraper with rotating headers...');
      
      // Delay aleatorio antes de hacer la petición (simula comportamiento humano)
      await randomDelay(300, 800);
      
      // Intentar con headers aleatorios
      let lastError = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries}...`);
          
          const headers = getRandomHeaders();
          const response = await fetch(url, { headers });

          if (response.ok) {
            data = await response.json();
            console.log('✓ Success!');
            break;
          }

          if (response.status === 403 || response.status === 429) {
            lastError = new Error(`Blocked by Sofascore (${response.status})`);
            
            if (attempt < maxRetries) {
              // Esperar más tiempo antes de reintentar
              const backoffDelay = attempt * 2000;
              console.log(`Waiting ${backoffDelay}ms before retry...`);
              await randomDelay(backoffDelay, backoffDelay + 1000);
              continue;
            }
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          lastError = err;
          if (attempt === maxRetries) break;
          await randomDelay(1000, 2000);
        }
      }

      if (!data) {
        throw lastError || new Error('Failed after all retries');
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message,
      hint: scraperApiKey ? '' : 'Consider using ScraperAPI for more reliable access (https://www.scraperapi.com)'
    });
  }
}
