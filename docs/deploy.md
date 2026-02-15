# Deploy de producción (API + Frontend)

## Regla principal
Producción correcta en Orbia = **mismo servidor Node** sirviendo:
1. `/api/*` (JSON)
2. archivos estáticos (`dist/public`)
3. fallback SPA **solo para rutas NO-API**

## Flujo recomendado (prod local)
```bash
npm run build
node dist/index.cjs
```

### Verificaciones rápidas
```bash
curl -i http://localhost:5000/api/health
```
Debe responder JSON con `200`.

```bash
curl -i http://localhost:5000/api/not-found
```
Debe responder JSON con `404` y `{ error, code }`.

> `GET /api/*` nunca debe devolver HTML.

## Por qué `serve -s dist/public` NO es producción real
`serve -s` solo entrega estáticos + fallback SPA. No ejecuta backend Express.
Por eso `/api/*` puede responder HTML y romper el cliente si intenta parsear JSON.

Ahora el frontend detecta ese escenario y muestra mensaje humano:
> “No se pudo conectar a la API. La app está en modo estático. Iniciá el servidor (node dist/index.cjs) o configurá API_URL.”

## API base URL por entorno
Se usa `VITE_API_BASE_URL`.

### Defaults
- Dev (vite): `/api`
- Prod monolito (mismo backend): `/api`
- Prod separado: `VITE_API_BASE_URL=https://tu-backend.com/api`

### Ejemplos
```bash
# Monolito
VITE_API_BASE_URL=/api npm run build

# Frontend separado de backend
VITE_API_BASE_URL=https://api.midominio.com/api npm run build
```

La app normaliza automáticamente la base y evita doble `/api`.

## Instalación PWA (sin prompts automáticos)
- El botón de instalación se muestra **solo** en `/app/settings`, dentro de la sección **Aplicación**.
- Si el navegador dispara `beforeinstallprompt`, se muestra `Descargar app`.
- Si la app ya está instalada (standalone), se muestra `Orbia ya está instalada ✅`.
- En iPhone/iOS (sin `beforeinstallprompt`), se muestran instrucciones:
  - `Para instalar en iPhone: Compartir → Agregar a pantalla de inicio.`

### Prueba manual recomendada
```bash
npm run dev
```
1. Abrir `/app/settings` en Chrome/Edge/Brave y validar que no hay prompt automático.
2. Verificar que aparece el bloque **Aplicación** y el botón `Descargar app` solo cuando el navegador permite instalar.
3. Instalar la app, recargar y confirmar estado `Orbia ya está instalada ✅`.
4. En iOS, confirmar que aparece el texto de instrucción y no un botón roto.
