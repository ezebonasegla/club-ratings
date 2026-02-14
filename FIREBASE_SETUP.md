# 🔥 Configuración de Firebase

Para habilitar la sincronización en la nube, necesitas configurar Firebase:

## 1. Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Nombra tu proyecto (ej: "river-ratings")
4. Sigue los pasos de configuración

## 2. Habilitar Firestore

1. En el menú lateral, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Elige el modo de producción
4. Selecciona la ubicación (recomendado: southamerica-east1 para Argentina)

## 3. Configurar Reglas de Seguridad

En Firestore > Reglas, agrega:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer/escribir sus propios datos
    match /ratings/{ratingId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

## 4. Habilitar Autenticación

1. Ve a **Authentication** en el menú lateral
2. Haz clic en "Comenzar"
3. Habilita los métodos de inicio de sesión que quieras:
   - **Email/Password** (recomendado para empezar)
   - Google
   - Facebook
   - etc.

## 5. Registrar tu App Web

1. En la página principal del proyecto, haz clic en el ícono **</>** (Web)
2. Registra tu app con un nombre (ej: "River Ratings Web")
3. Copia la configuración de Firebase que aparece

## 6. Actualizar Configuración Local

Abre el archivo `src/config/firebase.js` y reemplaza los valores:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",  // Tu API Key
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## 7. Configurar Dominio Autorizado

1. En Firebase Console, ve a **Authentication > Settings**
2. En la pestaña "Authorized domains", agrega:
   - `localhost` (ya está por defecto)
   - Tu dominio de producción si lo tienes

## 8. Probar la Conexión

Una vez configurado, la app debería:
- ✅ Guardar valoraciones en Firestore
- ✅ Sincronizar entre dispositivos
- ✅ Mantener datos por usuario
- ✅ Funcionar offline con caché local

## Estructura de Datos en Firestore

```
ratings/
  ├── {ratingId}/
  │   ├── userId: "abc123"
  │   ├── timestamp: "2026-02-13T..."
  │   ├── matchInfo: {...}
  │   ├── players: [...]
  │   ├── createdAt: Timestamp
  │   └── updatedAt: Timestamp
```

## Próximos Pasos

- [ ] Implementar página de Login/Registro
- [ ] Crear contexto de autenticación
- [ ] Migrar componentes para usar `cloudStorageService.js`
- [ ] Agregar indicador de estado de sincronización
- [ ] Implementar modo offline con caché

## Costos

Firebase ofrece un plan gratuito generoso:
- **Firestore**: 50,000 lecturas/día
- **Authentication**: Ilimitado
- **Storage**: 1 GB

Para una app personal, esto es más que suficiente.

---

¿Necesitas ayuda con la configuración? ¡Consulta la [documentación oficial de Firebase](https://firebase.google.com/docs)!
