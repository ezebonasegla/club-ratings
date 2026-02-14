# 📚 Guía de Uso - River Plate Valoraciones

## 🎬 Primeros Pasos

### 1. Iniciar la Aplicación

```bash
cd river-ratings
npm run dev
```

Abre tu navegador en `http://localhost:5173`

## 📋 Cómo Valorar un Partido

### Paso 1: Obtener la URL de Sofascore

1. Ve a [Sofascore](https://www.sofascore.com)
2. Busca el partido de River Plate que quieres valorar
3. Copia la URL completa (debe incluir el ID del partido)

**Ejemplo de URL válida:**
```
https://www.sofascore.com/football/match/argentinos-juniors-river-plate/lobsqob#id:15270113
```

### Paso 2: Cargar los Datos

1. En la app, ve a la página "Valorar Partido"
2. Pega la URL en el campo de texto
3. Haz clic en "Cargar Partido"
4. Espera unos segundos mientras se cargan los datos

### Paso 3: Asignar Calificaciones

Los jugadores aparecerán divididos en:
- **Titulares**: Los 11 que empezaron el partido
- **Suplentes**: Los que ingresaron durante el partido

Para cada jugador verás:
- 🔢 Número de camiseta
- 👤 Nombre completo
- 📍 Posición
- ⏱️ Minutos jugados
- ⚽ Goles (si los hizo)
- 🅰️ Asistencias (si las dio)
- 🟨 Tarjeta amarilla (si la recibió)
- 🟥 Tarjeta roja (si la recibió)

**Asigna una nota de 0 a 10** en el campo correspondiente.

### Paso 4: Guardar

1. Revisa que las notas estén correctas
2. Haz clic en "Guardar Valoraciones"
3. ✅ Verás un mensaje de confirmación
4. Los datos se guardan automáticamente en tu navegador

## 📊 Cómo Usar el Dashboard

### Vista General

Al entrar al Dashboard verás:

1. **Cards de Resumen**
   - Total de partidos valorados
   - Cantidad de jugadores diferentes
   - Promedio general del equipo
   - Mejor jugador (mayor promedio)

2. **Gráfico de Top 10**
   - Los 10 mejores jugadores por promedio
   - Puedes cambiar el ordenamiento con el selector

3. **Tabla Completa**
   - Todos los jugadores con estadísticas
   - Columnas: Partidos, Promedio, Goles, Asistencias, Minutos
   - Los 3 primeros están destacados en amarillo

4. **Distribución de Notas**
   - Gráfico de barras mostrando cuántas notas hay en cada rango
   - Útil para ver si estás siendo muy exigente o generoso

5. **Últimos Partidos**
   - Historial de los últimos 10 partidos valorados

### Ver Detalle de un Jugador

1. En la tabla, haz clic en "Ver Detalle" de cualquier jugador
2. Se abrirá un modal con:
   - Resumen de estadísticas
   - Gráfico de evolución (últimas 5 actuaciones)
   - Lista detallada de todas sus actuaciones

### Ordenar Datos

En el selector "Ordenar por" puedes elegir:
- **Promedio de Nota**: Los mejores calificados
- **Partidos Jugados**: Los más regulares
- **Goles**: Los goleadores
- **Asistencias**: Los asistidores

## 💡 Consejos y Mejores Prácticas

### Escala de Calificación Sugerida

- **9-10**: Actuación extraordinaria, figura del partido
- **7-8**: Muy buen partido, cumplió con creces
- **6-7**: Buen partido, cumplió su función
- **5-6**: Partido regular, algunos errores
- **3-5**: Mal partido, muchos errores
- **0-3**: Pésimo partido, no apareció

### Criterios a Considerar

Al calificar, ten en cuenta:
- ✅ Desempeño técnico
- ✅ Decisiones tácticas
- ✅ Intensidad y actitud
- ✅ Impacto en el resultado
- ✅ Cumplimiento de su rol

**Tip**: Sé consistente con tus criterios para que las comparaciones sean válidas.

### Frecuencia de Uso

Para mejores estadísticas:
- Valora todos los partidos oficiales
- Hazlo poco después del partido (mientras está fresco)
- No te saltes partidos (sesga las estadísticas)

## 🔧 Solución de Problemas

### "Error al obtener datos del partido"

**Causas posibles:**
1. URL incorrecta o incompleta
2. Partido muy antiguo o no disponible
3. Problemas de CORS (restricciones del navegador)

**Soluciones:**
1. Verifica que la URL incluya el `id:XXXXXXXX`
2. Prueba con un partido más reciente
3. La app cargará datos de demostración si falla

### Los datos no se guardan

**Causas posibles:**
1. Navegador en modo incógnito
2. Almacenamiento lleno
3. Configuración del navegador

**Soluciones:**
1. Usa el navegador en modo normal
2. Limpia datos antiguos
3. Revisa permisos de almacenamiento local

### La página está en blanco

**Soluciones:**
1. Recarga la página (Ctrl/Cmd + R)
2. Limpia la caché del navegador
3. Verifica la consola de desarrollador (F12)

## 📱 Uso en Móvil

La app funciona perfectamente en móviles:

1. Abre el navegador en tu teléfono
2. Ve a la URL local o de producción
3. Todo se adapta automáticamente
4. Puedes agregar a pantalla de inicio para acceso rápido

**En iOS Safari:**
- Toca el botón "Compartir"
- Selecciona "Agregar a pantalla de inicio"

**En Android Chrome:**
- Toca el menú (⋮)
- Selecciona "Agregar a pantalla de inicio"

## 🎯 Casos de Uso

### Para Analistas

- Lleva registro profesional de actuaciones
- Identifica patrones de rendimiento
- Compara jugadores en misma posición
- Genera informes visuales

### Para Hinchas

- Registra tu opinión de cada partido
- Debate con datos concretos
- Sigue la evolución de tus favoritos
- Comparte estadísticas con amigos

### Para Blogs/Medios

- Respaldo numérico para artículos
- Gráficos para contenido visual
- Historial completo de temporada
- Rankings objetivos

## ❓ Preguntas Frecuentes

**¿Los datos se guardan en la nube?**
No, se guardan solo en tu navegador (LocalStorage).

**¿Puedo usar esto en múltiples dispositivos?**
No automáticamente, pero puedes exportar e importar los datos.

**¿Cuántos partidos puedo guardar?**
Depende del navegador, pero típicamente cientos sin problema.

**¿Funciona sin internet?**
Una vez cargada, sí. Pero necesitas internet para cargar datos de Sofascore.

**¿Puedo editar valoraciones antiguas?**
Actualmente no, pero es una mejora futura planeada.

---

¿Dudas o sugerencias? Abre un issue en GitHub 🚀
