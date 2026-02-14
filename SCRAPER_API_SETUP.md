# Configurar ScraperAPI para Sofascore

## Problema
Sofascore bloquea peticiones directas con código 403 (protección anti-bot Cloudflare).

## Solución: ScraperAPI

ScraperAPI es un servicio especializado en bypasear protecciones anti-bot y Cloudflare.

### Paso 1: Registrarse

1. Ve a https://www.scraperapi.com/signup
2. Crea una cuenta gratuita (no necesitas tarjeta de crédito)
3. Plan gratuito incluye: **1,000 requests/mes**

### Paso 2: Obtener API Key

1. Después de registrarte, ve al Dashboard
2. Copia tu API Key (algo como: `abc123def456...`)

### Paso 3: Agregar a Variables de Entorno

**Desarrollo local:**
Agrega a tu archivo `.env`:
```env
SCRAPER_API_KEY=tu_api_key_aqui
```

**Producción (Vercel):**
1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega nueva variable:
   - **Name**: `SCRAPER_API_KEY`
   - **Value**: `tu_api_key_aqui`
   - Marca las 3 opciones (Production, Preview, Development)
4. Guarda y redeploy

### Paso 4: Redeploy

```bash
git add .
git commit -m "Add ScraperAPI support"
git push
```

Vercel detectará la nueva variable de entorno y la app funcionará!

## Cómo Funciona

```
Tu App → Vercel Function → ScraperAPI → Sofascore → ✅ Respuesta
```

ScraperAPI:
- Rota IPs automáticamente
- Resuelve captchas de Cloudflare
- Maneja JavaScript rendering
- Headers y cookies automáticos

## Alternativa sin ScraperAPI

Si no quieres usar ScraperAPI, la función intentará acceso directo (probablemente falle con 403).

## Límites del Plan Gratuito

- 1,000 requests/mes
- Suficiente para ~30-50 partidos valorados/mes
- Si necesitas más, upgrade a $49/mes (100,000 requests)

## Verificar que Funciona

Después de configurar, recarga tu app y prueba "Valorar Último Partido".
En los logs de Vercel deberías ver: `Using ScraperAPI...`
