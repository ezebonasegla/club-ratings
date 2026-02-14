// Vercel Serverless Function - Proxy para Sofascore API
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
    
    const response = await axios.get(sofascoreUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://www.sofascore.com/',
        'Origin': 'https://www.sofascore.com'
      }
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying Sofascore request:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching from Sofascore',
      message: error.message,
      details: error.response?.data || null
    });
  }
}
