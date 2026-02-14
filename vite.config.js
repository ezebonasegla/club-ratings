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
          // En desarrollo, intentar acceso directo (funciona desde localhost)
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Referer': 'https://www.sofascore.com/',
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Dev proxy error:', errorText);
            throw new Error(`Sofascore responded with status ${response.status}`);
          }

          const data = await response.json();
          
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(data));
        } catch (error) {
          console.error('Dev proxy error:', error);
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


