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
    // Usar corsproxy.io - más confiable para APIs protegidas
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Proxy error ${response.status}:`, errorText);
      throw new Error(`Proxy responded with status ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Sofascore', 
      message: error.message 
    });
  }
}
