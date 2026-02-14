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
          // Usar corsproxy.io en desarrollo
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
          const response = await fetch(proxyUrl, {
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Dev proxy error:', errorText);
            throw new Error(`Proxy responded with status ${response.status}`);
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


