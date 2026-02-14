// Vercel Serverless Function - Proxy para BeSoccer
import axios from 'axios';
import * as cheerio from 'cheerio';

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

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      timeout: 20000
    });

    return res.status(200).send(response.data);
  } catch (error) {
    console.error('Error fetching BeSoccer:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching from BeSoccer',
      message: error.message,
      statusCode: error.response?.status
    });
  }
}
