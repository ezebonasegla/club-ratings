// Vercel Serverless Function - Proxy para BeSoccer con parsing
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(req, res) {
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

  const { url, action } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Connection': 'keep-alive'
      },
      timeout: 20000
    });

    // Si se pide acción específica, parsear con cheerio
    if (action === 'findLastMatch') {
      const $ = cheerio.load(response.data);
      const matches = [];
      
      $('a.match-link').each((i, elem) => {
        const $elem = $(elem);
        const hasEndTag = $elem.find('.tag.end').length > 0;
        
        if (hasEndTag) {
          matches.push({
            url: $elem.attr('href'),
            homeTeam: $elem.find('.team_left .name').text().trim(),
            awayTeam: $elem.find('.team_right .name').text().trim(),
            score: $elem.find('.marker').text().trim(),
            date: $elem.find('.date').text().trim()
          });
        }
      });
      
      return res.status(200).json({ matches });
    }

    // Por defecto, devolver HTML crudo
    return res.status(200).send(response.data);
  } catch (error) {
    console.error('Error fetching BeSoccer:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching from BeSoccer',
      message: error.message,
      statusCode: error.response?.status
    });
  }
};
