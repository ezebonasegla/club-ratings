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
    // Método 1: Usando thingproxy (muy confiable)
    async () => {
      console.log('Trying thingproxy...');
      const proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      return JSON.parse(text);
    },
    
    // Método 2: Usando AllOrigins
    async () => {
      console.log('Trying AllOrigins...');
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
    
    // Método 3: Usando cors.eu.org
    async () => {
      console.log('Trying cors.eu.org...');
      const proxyUrl = `https://cors.eu.org/${url}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
    
    // Método 4: Directo desde Vercel (sin navegador, más probabilidad de funcionar)
    async () => {
      console.log('Trying direct from Vercel...');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
        },
      });
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
    
    // Método 5: Usando corsproxy.io
    async () => {
      console.log('Trying corsproxy.io...');
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      return await response.json();
    },
  ];

  // Intentar cada método hasta que uno funcione
  let lastError = null;
  
  for (let i = 0; i < methods.length; i++) {
    try {
      const data = await methods[i]();
      console.log(`Success with method ${i + 1}!`);
      return res.status(200).json(data);
    } catch (error) {
      console.error(`Method ${i + 1} failed:`, error.message);
      lastError = error;
      // Pequeño delay antes del siguiente intento
      if (i < methods.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // Si todos los métodos fallaron
  console.error('All methods failed');
  return res.status(500).json({ 
    error: 'Failed to fetch from Sofascore', 
    message: lastError?.message || 'All access methods failed',
    hint: 'Sofascore API is temporarily blocking requests. Please try again in a few minutes.'
  });
}
