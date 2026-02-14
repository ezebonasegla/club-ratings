# 📁 Estructura del Proyecto

```
river-ratings/
│
├── public/                      # Archivos estáticos públicos
│   └── vite.svg                # Favicon
│
├── src/                        # Código fuente de la aplicación
│   ├── assets/                 # Recursos estáticos (imágenes, etc)
│   │   └── react.svg
│   │
│   ├── components/             # Componentes reutilizables
│   │   ├── Layout.jsx          # Layout principal con header y footer
│   │   └── Layout.css          # Estilos del layout
│   │
│   ├── pages/                  # Páginas de la aplicación
│   │   ├── RatingPage.jsx      # Página de valoración de partidos
│   │   ├── RatingPage.css      # Estilos de valoración
│   │   ├── DashboardPage.jsx   # Página de estadísticas
│   │   └── DashboardPage.css   # Estilos del dashboard
│   │
│   ├── services/               # Lógica de negocio y servicios
│   │   ├── sofascoreService.js # Servicio de integración con Sofascore API
│   │   └── storageService.js   # Servicio de almacenamiento local
│   │
│   ├── App.jsx                 # Componente raíz con routing
│   ├── App.css                 # Estilos globales de la app
│   ├── main.jsx                # Punto de entrada de React
│   └── index.css               # Reset CSS y estilos base
│
├── .eslintrc.cjs               # Configuración de ESLint
├── .gitignore                  # Archivos ignorados por Git
├── index.html                  # HTML base
├── package.json                # Dependencias y scripts
├── package-lock.json           # Lockfile de dependencias
├── vite.config.js              # Configuración de Vite
│
├── README.md                   # Documentación principal
├── GUIA_DE_USO.md             # Guía de uso detallada
├── SOFASCORE_API.md           # Documentación de la API
├── MEJORAS_FUTURAS.md         # Ideas de mejoras
└── ESTRUCTURA.md              # Este archivo
```

## 📄 Descripción de Archivos Clave

### `/src/App.jsx`
Componente principal que configura el enrutamiento de la aplicación usando React Router.

**Responsabilidades:**
- Configurar rutas
- Envolver la app con el Layout
- Punto de entrada de la aplicación

### `/src/components/Layout.jsx`
Componente de layout que envuelve todas las páginas.

**Contiene:**
- Header con navegación
- Área de contenido principal
- Footer

### `/src/pages/RatingPage.jsx`
Página principal para valorar partidos.

**Funcionalidades:**
- Input para URL de Sofascore
- Carga de datos del partido
- Lista de jugadores con inputs de calificación
- Botón para guardar valoraciones

### `/src/pages/DashboardPage.jsx`
Página de estadísticas y visualizaciones.

**Funcionalidades:**
- Cards de resumen general
- Gráfico de barras de top jugadores
- Tabla completa de estadísticas
- Gráfico de distribución de notas
- Historial de partidos
- Modal de detalle de jugador

### `/src/services/sofascoreService.js`
Servicio que interactúa con la API de Sofascore.

**Funciones principales:**
- `extractMatchId(url)`: Extrae el ID del partido de la URL
- `fetchMatchData(matchUrl)`: Obtiene datos completos del partido
- `getDemoData(url)`: Retorna datos de demostración

### `/src/services/storageService.js`
Servicio que maneja el almacenamiento local.

**Funciones principales:**
- `saveRating(rating)`: Guarda una valoración
- `getAllRatings()`: Obtiene todas las valoraciones
- `getRatingById(id)`: Obtiene una valoración específica
- `deleteRating(id)`: Elimina una valoración
- `getPlayerStats(playerName)`: Estadísticas de un jugador
- `getAllPlayersStats()`: Estadísticas de todos los jugadores
- `getGeneralStats()`: Estadísticas generales
- `exportData()`: Exporta datos a JSON
- `importData(jsonData)`: Importa datos desde JSON
- `clearAllRatings()`: Limpia todas las valoraciones

## 🎨 Arquitectura CSS

### Estrategia de Estilos

Cada componente/página tiene su propio archivo CSS:

```
Component.jsx  →  Component.css
```

**Ventajas:**
- Organización clara
- Fácil mantenimiento
- No hay colisión de nombres (scoping manual)

### Variables CSS (Colores de River)

```css
/* Colores principales */
--river-red: #E30613
--river-red-dark: #b8050f
--river-white: #FFFFFF
--river-black: #000000

/* Colores de rating */
--rating-high: #4caf50   (verde)
--rating-medium: #ff9800 (naranja)
--rating-low: #f44336    (rojo)
```

## 📦 Dependencias Principales

### Producción
- `react` (^18.3.1): Framework principal
- `react-dom` (^18.3.1): Renderizado de React
- `react-router-dom` (^7.1.4): Routing
- `axios` (^1.7.9): HTTP client
- `recharts` (^2.15.1): Gráficos y visualizaciones
- `lucide-react` (^0.469.0): Iconos

### Desarrollo
- `vite` (^7.3.1): Build tool
- `@vitejs/plugin-react` (^4.3.4): Plugin de React para Vite
- `eslint` (^9.17.0): Linter

## 🔄 Flujo de Datos

```
Usuario → RatingPage
    ↓
Ingresa URL
    ↓
sofascoreService.fetchMatchData()
    ↓
API Sofascore / Datos Demo
    ↓
Procesa y muestra jugadores
    ↓
Usuario asigna notas
    ↓
storageService.saveRating()
    ↓
LocalStorage
    ↓
DashboardPage lee datos
    ↓
storageService.getAllPlayersStats()
    ↓
Muestra gráficos y tablas
```

## 🗄️ Estructura de Datos en LocalStorage

**Key:** `river_player_ratings`

**Valor:** Array de objetos Rating

```javascript
[
  {
    id: 1707856800000,
    timestamp: "2026-02-13T20:00:00.000Z",
    matchInfo: {
      date: "12/02/2026",
      rival: "Argentinos Juniors",
      competition: "Liga Profesional",
      score: "1 - 0"
    },
    players: [
      {
        id: 123,
        name: "Franco Armani",
        position: "Goalkeeper",
        rating: 7.5,
        minutesPlayed: 90,
        goals: 0,
        assists: 0
      },
      // ... más jugadores
    ]
  },
  // ... más partidos
]
```

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo

# Producción
npm run build        # Compila para producción
npm run preview      # Vista previa de la build

# Linting
npm run lint         # Ejecuta ESLint
```

## 📊 Flujo de Componentes

```
App
 ├─ Router
 │   └─ Layout
 │       ├─ Header (nav links)
 │       ├─ Main Content
 │       │   ├─ RatingPage (/)
 │       │   │   ├─ URL Input
 │       │   │   ├─ Match Info Display
 │       │   │   ├─ Players List
 │       │   │   │   └─ Player Cards
 │       │   │   └─ Save Button
 │       │   │
 │       │   └─ DashboardPage (/dashboard)
 │       │       ├─ Stats Cards
 │       │       ├─ Bar Chart (Top 10)
 │       │       ├─ Players Table
 │       │       ├─ Distribution Chart
 │       │       ├─ Recent Matches
 │       │       └─ Player Detail Modal
 │       │
 │       └─ Footer
```

## 🔐 Consideraciones de Seguridad

1. **LocalStorage**: Los datos son accesibles desde JavaScript
2. **CORS**: Implementar backend proxy en producción
3. **Validación**: Validar inputs de usuario
4. **Sanitización**: Limpiar datos de la API antes de renderizar

## 🌐 URLs de la Aplicación

- **Home (Valorar)**: `/`
- **Dashboard**: `/dashboard`

## 📝 Convenciones de Código

### Nombres de Archivos
- Componentes: PascalCase (ej: `RatingPage.jsx`)
- Servicios: camelCase (ej: `storageService.js`)
- Estilos: igual que el componente (ej: `RatingPage.css`)

### Nombres de Funciones
- Componentes: PascalCase
- Funciones: camelCase
- Handlers: prefijo `handle` (ej: `handleSaveRatings`)

### Estructura de Componentes
```javascript
// 1. Imports
import React, { useState } from 'react';
import './Component.css';

// 2. Componente
const Component = () => {
  // 3. Estados
  const [state, setState] = useState();
  
  // 4. Efectos
  useEffect(() => {}, []);
  
  // 5. Funciones
  const handleAction = () => {};
  
  // 6. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

// 7. Export
export default Component;
```

---

Esta estructura está diseñada para ser escalable y mantenible. Cada módulo tiene una responsabilidad clara y está organizado de forma lógica. 🚀
