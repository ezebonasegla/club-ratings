# River Ratings - Guía de Despliegue 🚀

## Opción 1: Vercel (Recomendado - Más fácil)

### Pasos:

1. **Crear cuenta en Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión con tu cuenta de GitHub

2. **Subir tu proyecto a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/river-ratings.git
   git push -u origin main
   ```

3. **Importar proyecto en Vercel**
   - En Vercel, haz clic en "Add New" > "Project"
   - Selecciona tu repositorio `river-ratings`
   - Vercel detectará automáticamente que es un proyecto Vite

4. **Configurar Variables de Entorno**
   - En la sección "Environment Variables" agrega cada variable:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_MEASUREMENT_ID`
   
   Copia los valores desde tu archivo `.env`

5. **Deploy**
   - Haz clic en "Deploy"
   - En 2-3 minutos tu app estará en línea
   - Recibirás una URL como: `https://river-ratings.vercel.app`

### Actualizar después de cambios:
```bash
git add .
git commit -m "descripción de cambios"
git push
```
Vercel desplegará automáticamente los cambios.

---

## Opción 2: Netlify

1. **Crear cuenta en Netlify**
   - Ve a [netlify.com](https://netlify.com)
   - Inicia sesión con GitHub

2. **Subir proyecto a GitHub** (mismo paso que Vercel)

3. **Importar en Netlify**
   - "Add new site" > "Import an existing project"
   - Selecciona tu repositorio
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Variables de entorno**
   - Ve a "Site settings" > "Environment variables"
   - Agrega todas las variables `VITE_FIREBASE_*`

5. **Deploy**
   - Netlify construirá y desplegará automáticamente

---

## Opción 3: Firebase Hosting

1. **Instalar Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login en Firebase**
   ```bash
   firebase login
   ```

3. **Inicializar Hosting**
   ```bash
   firebase init hosting
   ```
   - Select project: `ratings-e43df`
   - Public directory: `dist`
   - Single-page app: `Yes`
   - GitHub deploys: `No` (por ahora)

4. **Build y Deploy**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

---

## Configurar dominio personalizado (Opcional)

### En Vercel:
1. Ve a "Settings" > "Domains"
2. Agrega tu dominio
3. Configura los DNS según las instrucciones

### En Netlify:
1. "Domain settings" > "Add custom domain"
2. Sigue las instrucciones de DNS

---

## Importante: Seguridad Firebase

Después de desplegar, **configura las restricciones de Firebase**:

1. Ve a [Firebase Console](https://console.firebase.google.com/project/ratings-e43df/settings/general/web)
2. En "API Key restrictions":
   - Agrega tu dominio de producción (ejemplo: `river-ratings.vercel.app`)
   - Esto evita que otros usen tu API key

3. En Authentication > Settings:
   - Agrega tu dominio a "Authorized domains"

---

## Verificar que funciona

1. Abre la URL de tu app desplegada
2. Prueba:
   - Login/Registro
   - Cargar último partido
   - Valorar partido
   - Ver estadísticas
   - Gestionar valoraciones

---

## Problemas comunes

### "Firebase not initialized"
- Verifica que todas las variables de entorno estén configuradas en la plataforma

### "CORS error"
- Asegúrate de que el dominio esté en "Authorized domains" de Firebase

### "Build fails"
- Revisa que `npm run build` funcione localmente primero
- Verifica que todas las dependencias estén en `package.json`

---

## Recomendación final

**Usa Vercel** - Es lo más simple y rápido. Con GitHub conectado, cada push despliega automáticamente.

Tu URL quedará algo como: `https://river-ratings-tu-usuario.vercel.app`
