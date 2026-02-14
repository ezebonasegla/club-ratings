# ⚡ Inicio Rápido

## 🚀 En 3 pasos

### 1️⃣ Instalar dependencias
```bash
cd river-ratings
npm install
```

### 2️⃣ Iniciar la aplicación
```bash
npm run dev
```

### 3️⃣ Abrir en el navegador
```
http://localhost:5173
```

## 🎯 Primera Valoración

1. **Ve a la página principal** (ya deberías estar ahí)

2. **Pega esta URL de ejemplo:**
   ```
   https://www.sofascore.com/football/match/argentinos-juniors-river-plate/lobsqob#id:15270113
   ```

3. **Haz clic en "Cargar Partido"**
   - Se cargarán datos de demostración del partido Argentinos Juniors vs River Plate

4. **Asigna notas a los jugadores**
   - Escala de 0 a 10
   - Puedes usar decimales (ej: 7.5)

5. **Guarda la valoración**
   - Haz clic en "Guardar Valoraciones"
   - Verás un mensaje de éxito

6. **Ve al Dashboard**
   - Haz clic en "Dashboard" en el menú superior
   - Explora las estadísticas y gráficos

## 📱 Navegación

- **🏠 Valorar Partido**: Página principal para agregar nuevas valoraciones
- **📊 Dashboard**: Ver estadísticas, gráficos y comparativas

## 🎨 Características Principales

### Valorar Partido
✅ Carga automática de datos desde Sofascore  
✅ Info completa del partido (fecha, rival, resultado)  
✅ Jugadores con estadísticas (goles, asistencias, minutos)  
✅ Sistema de notas de 0 a 10  
✅ Guardado automático en el navegador  

### Dashboard
✅ Resumen general (partidos, jugadores, promedios)  
✅ Top 10 mejores jugadores con gráfico  
✅ Tabla completa ordenable por múltiples criterios  
✅ Gráfico de distribución de notas  
✅ Historial de partidos valorados  
✅ Vista detallada por jugador con evolución  

## 💾 Tus Datos

- Se guardan **localmente** en tu navegador
- No se envían a ningún servidor
- Persisten entre sesiones
- Puedes limpiar el caché para resetear

## 🆘 Problemas Comunes

### La app no carga
```bash
# Asegúrate de estar en el directorio correcto
cd river-ratings

# Reinstala dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error al cargar partido
- La app usa datos de demostración si falla la API
- Esto es normal y esperado
- Puedes seguir usando la app con esos datos

### Los datos no se guardan
- Verifica que no estés en modo incógnito
- Revisa que el navegador permita LocalStorage

## 📚 Más Información

- 📖 [README.md](README.md) - Documentación completa
- 📘 [GUIA_DE_USO.md](GUIA_DE_USO.md) - Guía detallada de uso
- 🌐 [SOFASCORE_API.md](SOFASCORE_API.md) - Info sobre la API
- 🚀 [MEJORAS_FUTURAS.md](MEJORAS_FUTURAS.md) - Próximas funcionalidades
- 📁 [ESTRUCTURA.md](ESTRUCTURA.md) - Arquitectura del proyecto

## 🎉 ¡Listo!

Ya puedes empezar a valorar los partidos de River Plate y llevar un registro completo de las actuaciones de los jugadores.

**¡Vamos River! 🔴⚪**

---

¿Problemas? Abre un issue en GitHub o revisa la documentación completa.
