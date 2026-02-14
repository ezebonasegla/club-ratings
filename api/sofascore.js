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
    try {
      const response = await axios.get(sofascoreUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.sofascore.com/',
          'Origin': 'https://www.sofascore.com',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'Cache-Control': 'max-age=0'
        },
        timeout: 10000
      });
      return res.status(200).json(response.data);
    } catch (directError) {
      // Estrategia 2: Usar proxy CORS público
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sofascoreUrl)}`;
      const proxyResponse = await axios.get(proxyUrl, { timeout: 15000 });
      
      // AllOrigins devuelve texto, intentar parsear como JSON
      const data = typeof proxyResponse.data === 'string' 
        ? JSON.parse(proxyResponse.data) 
        : proxyResponse.data;
      
      return res.status(200).json(data);
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
