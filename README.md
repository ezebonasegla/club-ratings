# 🔴⚪ River Plate - Sistema de Valoraciones

Aplicación web para llevar un registro detallado de las valoraciones de los jugadores de River Plate partido a partido.

## 🚀 Características

### 📝 Módulo de Valoración
- **Carga automática de datos** desde URLs de Sofascore
- Información del partido: fecha, rival, resultado, competición
- Lista de jugadores titulares y suplentes
- Estadísticas automáticas: minutos jugados, goles, asistencias, tarjetas
- Sistema de calificación de 0 a 10 por jugador
- Guardado local de valoraciones

### 📊 Dashboard de Estadísticas
- **Resumen general**: total de partidos, jugadores, promedio del equipo
- **Top 10 jugadores** con gráfico de barras
- **Tabla completa de estadísticas** con ordenamiento múltiple
- **Distribución de notas** mediante gráficos
- **Historial de partidos** valorados
- **Vista detallada por jugador**:
  - Evolución de notas en últimos 5 partidos
  - Estadísticas acumuladas
  - Historial completo de actuaciones

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
   - Últimos partidos
3. Haz clic en "Ver Detalle" en cualquier jugador para ver su evolución

## 🔧 Tecnologías

- **React 18** - Framework principal
- **Vite** - Build tool
- **React Router** - Navegación
- **Recharts** - Gráficos y visualizaciones
- **Axios** - Peticiones HTTP
- **Lucide React** - Iconos
- **LocalStorage** - Persistencia de datos

## 📡 API de Sofascore

La aplicación utiliza la API pública de Sofascore para obtener datos de partidos:

```javascript
// Endpoints utilizados
https://api.sofascore.com/api/v1/event/{matchId}
https://api.sofascore.com/api/v1/event/{matchId}/lineups
https://api.sofascore.com/api/v1/event/{matchId}/incidents
```

**Importante sobre CORS:**

Sofascore tiene protección CORS. Para usar la aplicación en producción, necesitas:

1. **Opción 1 - Backend Proxy**: Crear un backend simple que haga las peticiones
2. **Opción 2 - Extension CORS** (solo para desarrollo local)
3. **Opción 3 - Datos de demostración**: La app incluye datos de ejemplo que se cargan automáticamente si la API falla

## 🎨 Personalización

### Colores de River Plate

Los colores principales están definidos en los archivos CSS:

```css
--river-red: #E30613;
--river-white: #FFFFFF;
--river-red-dark: #b8050f;
```

## 💾 Gestión de Datos

Los datos se guardan localmente en el navegador usando LocalStorage. Puedes exportar e importar tus valoraciones en formato JSON.

## 📱 Responsive Design

La aplicación está completamente optimizada para:
- 📱 Móviles (320px+)
- 📱 Tablets (768px+)
- 💻 Desktop (1024px+)
- 🖥️ Large screens (1400px+)

---

Desarrollado con ❤️ por un hincha de River Plate ⚽

