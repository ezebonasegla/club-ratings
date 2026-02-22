# Actualizar Reglas de Firestore

## Problema
El sistema de amigos necesita permisos en Firestore para las colecciones:
- `friendRequests` (solicitudes de amistad)
- `comments` (comentarios)
- `notifications` (notificaciones)

## Solución

### Opción 1: Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. En el menú lateral, ve a **Firestore Database**
4. Click en la pestaña **Reglas**
5. Copia y pega las reglas del archivo `firestore.rules`
6. Click en **Publicar**

### Opción 2: Firebase CLI

Si tienes Firebase CLI instalado:

```bash
firebase deploy --only firestore:rules
```

## Reglas Aplicadas

Las reglas en `firestore.rules` incluyen:

- ✅ **users**: Lectura pública (autenticados), escritura solo propietario
- ✅ **ratings**: Lectura pública (autenticados), escritura solo propietario
- ✅ **friendRequests**: Lectura/escritura para remitente y receptor
- ✅ **comments**: Lectura pública, creación autenticada, eliminación solo propietario
- ✅ **notifications**: Acceso solo para el usuario destinatario

## Verificar

Después de aplicar las reglas:
1. Refresca la aplicación
2. El error "Missing or insufficient permissions" debería desaparecer
3. Podrás ver solicitudes de amistad y notificaciones

## Nota Importante

Estas reglas son para desarrollo. En producción, considera:
- Validar estructura de datos con `request.resource.data`
- Agregar límites de tasa (rate limiting)
- Validar campos requeridos
- Agregar índices compuestos si es necesario
