/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Usa múltiples métodos de acceso gratuitos
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

  // Lista de métodos a intentar
  const methods = [
    // Método 1: Directo con headers mejorados
    async () => {
      console.log('Trying direct access...');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
      });
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
    
    // Método 2: Usando AllOrigins (CORS proxy gratuito)
    async () => {
      console.log('Trying AllOrigins proxy...');
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
    
    // Método 3: Usando otro CORS proxy
    async () => {
      console.log('Trying alternative CORS proxy...');
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
  ];

  // Intentar cada método hasta que uno funcione
  let lastError = null;
  
  for (const method of methods) {
    try {
      const data = await method();
      console.log('Success!');
      return res.status(200).json(data);
    } catch (error) {
      console.error(`Method failed:`, error.message);
      lastError = error;
      // Continuar con el siguiente método
    }
  }

  // Si todos los métodos fallaron
  console.error('All methods failed');
  return res.status(500).json({ 
    error: 'Failed to fetch from Sofascore', 
    message: lastError?.message || 'All access methods failed',
    hint: 'Sofascore API is temporarily unavailable. Please try again later.'
  });
}
