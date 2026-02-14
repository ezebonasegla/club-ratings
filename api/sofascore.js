// Vercel Serverless Function - Proxy para Sofascore API con múltiples estrategias
import axios from 'axios';

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  try {
    const sofascoreUrl = `https://api.sofascore.com/api/v1/${endpoint}`;
    
    // Estrategia 1: Intentar directamente con headers mejorados
    // Estrategia 1: Usar corsproxy.io (más confiable)
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sofascoreUrl)}`;
      const response = await axios.get(proxyUrl, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return res.status(200).json(response.data);
    } catch (proxyError) {
      // Estrategia 2: Intentar con otro proxy
      try {
        const fallbackUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(sofascoreUrl)}`;
        const fallbackResponse = await axios.get(fallbackUrl, { timeout: 15000 });
        
        const data = typeof fallbackResponse.data === 'string' 
          ? JSON.parse(fallbackResponse.data) 
          : fallbackResponse.data;
        
        return res.status(200).json(data);
      } catch (fallbackError) {
        // Si ambos proxies fallan, lanzar error
        throw new Error('All proxy strategies failed');
      }
    }
  } catch (error) {
    console.error('Error proxying Sofascore request:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching from Sofascore',
      message: error.message,
      details: error.response?.data || null
    });
  }
}
