import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin para simular la API en desarrollo
const apiPlugin = () => ({
  name: 'api-middleware',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.startsWith('/api/sofascore')) {
        const url = new URL(req.url, 'http://localhost:5173');
        const targetUrl = url.searchParams.get('url');
        
        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'URL parameter required' }));
          return;
        }

        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
              'Referer': 'https://www.sofascore.com/',
              'Origin': 'https://www.sofascore.com',
              'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"macOS"',
            },
          });

          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: error.message }));
        }
        return;
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
})


