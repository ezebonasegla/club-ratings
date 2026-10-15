/**
 * Vercel Serverless Function - Proxy para Sofascore API
 * Usa ScraperAPI para bypass de protecciones anti-bot.
 *
 * SofaScore a veces responde con una página HTML (bloqueo/desafío anti-bot) en
 * lugar de JSON. Por eso se valida cada respuesta y se prueban alternativas:
 * otro dominio de la API y, como último recurso, los proxies premium de ScraperAPI.
 */

const ATTEMPT_TIMEOUT_MS = 25000;
const TOTAL_BUDGET_MS = 55000;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
  'Cache-Control': 'no-cache',
};

// La misma API está disponible en dos dominios; uno puede estar bloqueado y el otro no
const withHost = (url, host) => url.replace(/^https:\/\/(api|www)\.sofascore\.com\/api\/v1\//, `https://${host}/api/v1/`);

const describeBody = (text) => {
  const title = text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  return title ? `HTML "${title}"` : `"${text.slice(0, 80).replace(/\s+/g, ' ')}"`;
};

// Hace la petición y devuelve el JSON, o lanza un error descriptivo
const fetchJson = async (requestUrl, headers, timeoutMs) => {
  const response = await fetch(requestUrl, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`status ${response.status}: ${describeBody(text)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`respuesta no JSON: ${describeBody(text)}`);
  }
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

  // Sólo permitir la API de SofaScore (evita que el proxy y los créditos se usen para otra cosa)
  if (!/^https:\/\/(api|www)\.sofascore\.com\/api\/v1\//.test(url)) {
    return res.status(400).json({ error: 'Only SofaScore API URLs are allowed' });
  }

  const scraperApiKey = process.env.SCRAPER_API_KEY;
  const hasScraperApi = scraperApiKey && scraperApiKey !== 'your_scraper_api_key_here';
  const scraperUrl = (target, extra = '') =>
    `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(target)}${extra}`;

  const wwwUrl = withHost(url, 'www.sofascore.com');
  const apiUrl = withHost(url, 'api.sofascore.com');
  const jsonHeaders = { Accept: 'application/json' };

  // Estrategias en orden: de la más barata a la más cara
  const attempts = hasScraperApi
    ? [
        { name: 'scraperapi www', run: (t) => fetchJson(scraperUrl(wwwUrl), jsonHeaders, t) },
        { name: 'scraperapi api', run: (t) => fetchJson(scraperUrl(apiUrl), jsonHeaders, t) },
        { name: 'scraperapi premium', run: (t) => fetchJson(scraperUrl(wwwUrl, '&premium=true'), jsonHeaders, t) },
      ]
    : [
        { name: 'directo www', run: (t) => fetchJson(wwwUrl, BROWSER_HEADERS, t) },
        { name: 'directo api', run: (t) => fetchJson(apiUrl, BROWSER_HEADERS, t) },
      ];

  const start = Date.now();
  const errors = [];

  for (const attempt of attempts) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
    if (remaining < 3000) break;

    try {
      const data = await attempt.run(Math.min(ATTEMPT_TIMEOUT_MS, remaining));

      if (!data || typeof data !== 'object' || data.error) {
        throw new Error(`error de SofaScore: ${JSON.stringify(data?.error ?? data).slice(0, 120)}`);
      }

      // Cachear en el CDN de Vercel: ScraperAPI tarda varios segundos por petición
      // y las mismas URLs se piden una y otra vez (mismo club, mismo partido).
      const isTeamEvents = /\/team\/\d+\/events\//.test(url);
      res.setHeader('Cache-Control', isTeamEvents ? 'public, s-maxage=60' : 'public, s-maxage=600');
      res.setHeader('X-Proxy-Strategy', attempt.name);
      return res.status(200).json(data);
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'timeout' : error.message;
      console.error(`Proxy intento "${attempt.name}" falló:`, message);
      errors.push(`${attempt.name}: ${message}`);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).json({
    error: 'Failed to fetch from Sofascore',
    message: `SofaScore bloqueó la consulta (${errors.join(' | ') || 'sin tiempo'})`,
  });
}
