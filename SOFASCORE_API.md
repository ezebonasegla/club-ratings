# 🌐 Integración con Sofascore API

## 📡 Endpoints Utilizados

La aplicación consume la API pública de Sofascore para obtener datos de partidos:

### 1. Datos del Evento
```
GET https://api.sofascore.com/api/v1/event/{matchId}
```

**Respuesta incluye:**
- Equipos (local y visitante)
- Marcador
- Fecha y hora
- Competición y ronda
- Estadio
- Árbitro

### 2. Alineaciones
```
GET https://api.sofascore.com/api/v1/event/{matchId}/lineups
```

**Respuesta incluye:**
- Jugadores titulares de ambos equipos
- Jugadores suplentes
- Formación táctica
- Números de camiseta
- Posiciones

### 3. Incidentes del Partido
```
GET https://api.sofascore.com/api/v1/event/{matchId}/incidents
```

**Respuesta incluye:**
- Goles (con asistencias)
- Tarjetas (amarillas y rojas)
- Sustituciones
- VAR
- Otros eventos importantes

## 🔍 Extracción del Match ID

El ID del partido se extrae de la URL de Sofascore:

```javascript
// Patrón de URL de Sofascore:
// https://www.sofascore.com/football/match/{equipos}/{slug}#id:{matchId}

// Ejemplos válidos:
"https://www.sofascore.com/football/match/argentinos-juniors-river-plate/lobsqob#id:15270113"
// Match ID: 15270113

"https://www.sofascore.com/boca-juniors-river-plate/lobsqob#id:12345678"
// Match ID: 12345678
```

**Regex utilizado:**
```javascript
/id[:\-](\d+)/
```

## 🔐 Problema de CORS

### ¿Qué es CORS?

CORS (Cross-Origin Resource Sharing) es una política de seguridad del navegador que bloquea peticiones desde dominios diferentes al de la API.

### Por qué Sofascore bloquea CORS

Sofascore protege su API para:
- Evitar uso no autorizado
- Controlar el tráfico
- Proteger sus datos

### Soluciones

#### Opción 1: Backend Proxy (Recomendado para Producción)

Crear un servidor backend que haga las peticiones:

**Con Node.js + Express:**

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/api/match/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [event, lineups, incidents] = await Promise.all([
      axios.get(`https://api.sofascore.com/api/v1/event/${id}`),
      axios.get(`https://api.sofascore.com/api/v1/event/${id}/lineups`),
      axios.get(`https://api.sofascore.com/api/v1/event/${id}/incidents`)
    ]);

    res.json({
      event: event.data,
      lineups: lineups.data,
      incidents: incidents.data
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching match data' });
  }
});

app.listen(3000, () => console.log('Proxy running on port 3000'));
```

**Con Python + Flask:**

```python
# server.py
from flask import Flask, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

@app.route('/api/match/<int:match_id>')
def get_match(match_id):
    try:
        event = requests.get(f'https://api.sofascore.com/api/v1/event/{match_id}').json()
        lineups = requests.get(f'https://api.sofascore.com/api/v1/event/{match_id}/lineups').json()
        incidents = requests.get(f'https://api.sofascore.com/api/v1/event/{match_id}/incidents').json()
        
        return jsonify({
            'event': event,
            'lineups': lineups,
            'incidents': incidents
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)
```

Luego en el frontend, cambiar:
```javascript
// En sofascoreService.js
const eventUrl = `http://localhost:3000/api/match/${matchId}`;
```

#### Opción 2: Proxy CORS (Solo Desarrollo)

Usar un servicio proxy público:

```javascript
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const eventUrl = `${CORS_PROXY}https://api.sofascore.com/api/v1/event/${matchId}`;
```

**⚠️ Advertencias:**
- No usar en producción
- Puede ser lento
- Puede estar caído

#### Opción 3: Extensión de Navegador (Solo Desarrollo Local)

Instalar una extensión CORS:
- Chrome: "CORS Unblock" o "Allow CORS"
- Firefox: "CORS Everywhere"

**⚠️ Solo para desarrollo**, no para usuarios finales.

#### Opción 4: Datos de Demostración (Implementado)

La app incluye datos de ejemplo que se cargan si la API falla:

```javascript
// En sofascoreService.js
catch (error) {
  if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
    return getDemoData(matchUrl);
  }
}
```

## 🏗️ Estructura de Datos

### Objeto Match Info
```javascript
{
  date: "12/02/2026",
  homeTeam: "Argentinos Juniors",
  awayTeam: "River Plate",
  rival: "Argentinos Juniors",
  competition: "Liga Profesional de Fútbol",
  round: "Fecha 5",
  score: "1 - 0"
}
```

### Objeto Player
```javascript
{
  id: 123456,
  name: "Juan Fernando Quintero",
  position: "Midfielder",
  shirtNumber: "10",
  starter: true,
  substitute: false,
  goals: 1,
  assists: 2,
  minutesPlayed: 90,
  yellowCard: false,
  redCard: false
}
```

## 🔄 Flujo de Datos

```
Usuario ingresa URL
       ↓
Extrae Match ID
       ↓
Consulta API Sofascore (3 endpoints en paralelo)
       ↓
Procesa respuestas JSON
       ↓
Identifica equipo de River
       ↓
Filtra jugadores de River
       ↓
Procesa incidentes (goles, tarjetas, cambios)
       ↓
Calcula minutos jugados
       ↓
Retorna datos estructurados
       ↓
Usuario califica jugadores
       ↓
Guarda en LocalStorage
```

## 📊 Mapeo de Posiciones

Sofascore usa códigos para posiciones:

```javascript
const POSITION_MAP = {
  'G': 'Goalkeeper',
  'D': 'Defender',
  'M': 'Midfielder',
  'F': 'Forward'
};
```

## ⚙️ Configuración Avanzada

### Rate Limiting

Para evitar bloqueos por muchas peticiones:

```javascript
// Implementar delay entre peticiones
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithDelay(url) {
  await sleep(1000); // 1 segundo entre peticiones
  return axios.get(url);
}
```

### Caché

Para evitar peticiones repetidas:

```javascript
const matchCache = new Map();

async function fetchMatchData(matchUrl) {
  const matchId = extractMatchId(matchUrl);
  
  if (matchCache.has(matchId)) {
    return matchCache.get(matchId);
  }
  
  const data = await doFetch(matchId);
  matchCache.set(matchId, data);
  return data;
}
```

### Headers Recomendados

```javascript
axios.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'es-AR,es;q=0.9'
  }
});
```

## 🚀 Deploy en Producción

### Con Vercel

1. Crear API en `/api/match/[id].js`:

```javascript
export default async function handler(req, res) {
  const { id } = req.query;
  
  try {
    const response = await fetch(`https://api.sofascore.com/api/v1/event/${id}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
}
```

2. Actualizar `sofascoreService.js`:
```javascript
const eventUrl = `/api/match/${matchId}`;
```

### Con Netlify

Similar a Vercel, usando Netlify Functions.

### Con Railway/Render

Deploy el backend proxy como servicio separado.

## 📝 Notas Importantes

1. **Respeta los términos de uso** de Sofascore
2. **No abuses** de la API con peticiones excesivas
3. **Implementa caché** para reducir peticiones
4. **Maneja errores** gracefully
5. **Datos de demo** siempre disponibles como fallback

## 🔗 Referencias

- [Sofascore Website](https://www.sofascore.com)
- [MDN CORS Documentation](https://developer.mozilla.org/es/docs/Web/HTTP/CORS)
- [Axios Documentation](https://axios-http.com/)

---

**Disclaimer**: Esta es una API pública no oficial. Úsala responsablemente.
