/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Usa AllOrigins como proxy intermedio para evitar bloqueos
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
    // Usar AllOrigins como proxy CORS - más confiable que intentar burlar a Sofascore directamente
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      console.error(`Proxy error ${response.status}`);
      throw new Error(`Proxy responded with status ${response.status}`);
    }

    const proxyData = await response.json();
    
    if (!proxyData.contents) {
      throw new Error('No data received from proxy');
    }

    // Parse el contenido JSON de Sofascore
    const data = JSON.parse(proxyData.contents);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message 
    });
  }
}
