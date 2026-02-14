# ⚽ Club Ratings - Sistema de Valoraciones del Fútbol Argentino

Aplicación web para llevar un registro detallado de las valoraciones de los jugadores de tu club favorito del fútbol argentino partido a partido.

## 🎯 Clubes Soportados

La app soporta **33 clubes del fútbol argentino**, incluyendo:
- 🔴⚪ River Plate
- 🔵🟡 Boca Juniors  
- 🔵⚪ Racing Club
- 🔴⚪ Independiente
- Y 29 clubes más de Primera División y Nacional

Cada usuario selecciona su club favorito y puede valorar únicamente los partidos de ese equipo.

## 🚀 Características

### 🏟️ Selección de Club
- Elige tu club favorito de entre 33 equipos argentinos
- Interfaz con logos y colores oficiales
- Cada usuario valora solo los partidos de su equipo

### 📝 Módulo de Valoración
- **Carga automática de datos** desde Sofascore API
- **Botón "Último Partido"** - Carga automáticamente el partido más reciente finalizado
- Información del partido: fecha, rival, resultado, competición
- Lista de jugadores titulares y suplentes con posiciones
- Estadísticas automáticas: minutos jugados, goles, asistencias, tarjetas
- Sistema de calificación de 0 a 10 por jugador
- **Prevención de duplicados** - No permite valorar dos veces el mismo partido
- **Indicadores de resultado** - Score con colores (verde=victoria, rojo=derrota, amarillo=empate)

### 📊 Dashboard de Estadísticas
- **Resumen general**: total de partidos, jugadores, promedio del equipo
- **Top 10 jugadores** con gráfico de barras
- **Tabla completa de estadísticas** con ordenamiento múltiple
- **Distribución de notas** mediante gráficos
- **Historial de partidos** valorados con colores según resultado
- **Vista detallada por jugador**:
  - Evolución de notas en últimos 5 partidos
  - Estadísticas acumuladas
  - Historial completo de actuaciones

### 🔐 Sistema de Usuarios
- Autenticación con Firebase (email/password)
- Datos sincronizados en la nube
- Cada usuario gestiona sus propias valoraciones
- Perfil personalizado con estadísticas

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build
```

## 🎯 Uso

### Valorar un Partido

1. Ve a la sección "Valorar Partido"
2. Pega la URL del partido de Sofascore (ejemplo: `https://www.sofascore.com/football/match/argentinos-juniors-river-plate/lobsqob#id:15270113`)
3. Haz clic en "Cargar Partido"
4. Los datos del partido y jugadores se cargarán automáticamente
5. Asigna una nota de 0 a 10 a cada jugador que quieras valorar
6. Haz clic en "Guardar Valoraciones"

### Ver Estadísticas

1. Ve a la sección "Dashboard"
2. Explora las diferentes visualizaciones:
   - Cards con resumen general
   - Gráfico de top jugadores
   - Tabla completa ordenable
   - Distribución de notas
   - Últimos partidos con indicadores de resultado (verde/rojo/amarillo)
3. Haz clic en "Ver Detalle" en cualquier jugador para ver su evolución

## 🔧 Tecnologías

- **React 19** - Framework principal
- **Vite 7.3** - Build tool y desarrollo
- **React Router 7** - Navegación
- **Firebase 12** - Autenticación y base de datos (Firestore)
- **Recharts 3** - Gráficos y visualizaciones
- **Axios** - Peticiones HTTP
- **Lucide React** - Iconos modernos
- **Vercel** - Hosting y serverless functions

## 📡 API de Sofascore

La aplicación utiliza la API pública de Sofascore para obtener datos de partidos:

```javascript
// Endpoints utilizados
https://api.sofascore.com/api/v1/event/{matchId}
https://api.sofascore.com/api/v1/event/{matchId}/lineups
https://api.sofascore.com/api/v1/event/{matchId}/incidents
https://api.sofascore.com/api/v1/team/{teamId}/events/last/0
```

**Solución CORS con ScraperAPI:**

Sofascore tiene protección anti-bot. La app usa **ScraperAPI** (1000 requests gratis/mes) para bypasear esto:

1. Registrate en https://www.scraperapi.com (gratis)
2. Agrega tu API key en las variables de entorno de Vercel
3. Ver [SCRAPER_API_SETUP.md](SCRAPER_API_SETUP.md) para instrucciones detalladas

## 🎨 Personalización

### Colores Dinámicos por Club

Cada club tiene sus colores oficiales definidos en `src/config/clubs.js`. La interfaz se adapta automáticamente al club seleccionado:

```javascript
{
  id: 1,
  name: 'River Plate',
  shortName: 'River',
  colors: {
    primary: '#E30613',
    secondary: '#FFFFFF'
  }
}
```

### Indicadores de Resultado

Los scores se muestran con colores según el resultado:
- 🟢 **Verde** - Victoria
- 🔴 **Rojo** - Derrota
- 🟡 **Amarillo** - Empate

## 💾 Gestión de Datos

Los datos se guardan en **Firebase Firestore**:
- Sincronización automática en la nube
- Acceso desde cualquier dispositivo
- Backup automático
- Edición y eliminación de valoraciones
- Historial completo persistente

## 🔐 Seguridad

- Autenticación con Firebase Auth
- Reglas de seguridad en Firestore
- Variables de entorno protegidas
- Cada usuario solo ve y modifica sus propios datos

## 📱 Responsive Design

La aplicación está completamente optimizada para:
- 📱 Móviles (320px+)
- 📱 Tablets (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large screens (1400px+)

## 🚀 Deploy

La app está desplegada en **Vercel**:
1. Conecta tu repositorio de GitHub
2. Configura las variables de entorno (Firebase + ScraperAPI)
3. Deploy automático en cada push
4. Ver [DEPLOY.md](DEPLOY.md) para instrucciones completas

## 📄 Licencia

Este proyecto es de código abierto. Siéntete libre de usarlo y modificarlo.

---

Desarrollado con ⚽ para los hinchas del fútbol argentino

