# Performance Audit (Railway) — Orbia

## Comandos de inventario ejecutados
- `rg -n "setInterval|setTimeout|addEventListener|on\\(|listen\\(|createReadStream|pipeline|fetch\\(|axios|ws|socket|SSE" client server ai-service`
- `rg -n "fetch\('/api/me/plan|/api/me/plan" client/src`
- `rg -n "preview|pdf" client/src/components client/src/pages`

## Inventario de recursos potencialmente vivos

### Timers / intervals
- `server/index.ts`: purge de tracking con `setInterval` cada 5 minutos.
  - Riesgo: el interval puede quedar vivo durante shutdown y consumir recursos.
  - ✅ Fix aplicado: cleanup explícito del interval en `SIGTERM` / `SIGINT` + `httpServer.close()`.

### Listeners / event handlers
- Se revisaron componentes con listeners/timers de UI; no se detectaron `addEventListener` globales sin cleanup en el módulo de settings, productos o voz.
- `usePlan` mantiene un set de listeners en memoria con cleanup en `useEffect` return.

### Requests externas sin timeout / abort
- `server/routes/stt.ts` llama a `AI_SERVICE_URL`.
  - ✅ Fix aplicado: `AbortController` + timeout configurable (`STT_TIMEOUT_MS`) + retry simple opcional (1 intento) y mensajes humanos.

### Streams / uploads
- Uploads de avatar y logo usan middleware de upload con validación de tamaño/tipo y rutas acotadas.
- No se detectaron streams manuales (`createReadStream/pipeline`) abiertos sin cierre en rutas auditadas de productos/PDF/STT.

### DB queries y límites
- Productos: listado con paginación y filtros server-side.
- Exportaciones PDF: límite duro por `MAX_EXPORT_ROWS`.
- Reportes mensuales: endpoint dedicado con validación y guardas de plan.

### Logs en producción
- `server/index.ts` antes serializaba payload JSON de respuestas API.
  - ✅ Fix aplicado: logging detallado solo en entorno no productivo.
- Logs de STT debug condicionados a `STT_DEBUG=true`.

---

## Optimización aplicada
1. Shutdown más limpio del backend para evitar intervals vivos.
2. Reducción de logs verbosos en producción.
3. Timeouts y resiliencia en STT para evitar requests colgados.
4. Gating por plan para evitar ejecutar rutas caras en planes sin acceso.
5. Cache en cliente para `/api/me/plan` (evita re-fetch duplicado por pantalla).

---

## Endpoints más pesados y mitigación
- `/api/pdfs/*`: generación de PDF
  - mitigación: límites por cantidad de productos + payload validado.
- `/api/ai/stt`: integración con servicio externo
  - mitigación: timeout, rate limit, concurrencia por tenant y retry acotado.
- `/api/products`: catálogos grandes
  - mitigación: filtros server-side y paginación.

---

## Pendiente / no aplica
- No se agregó APM de terceros (requisito explícito: sin herramientas pesadas).
- El perfilado de DB con carga real (80 tenants concurrentes) queda para ambiente staging/producción con datos reales.

## Session lifecycle audit (auth/logout)
- Token lifecycle detectado:
  - Login: `/api/auth/login` y `/api/auth/super/login` emiten JWT.
  - Cliente: token/user en `localStorage` (`orbia_token`, `orbia_user`).
  - Header auth: se inyecta en `apiRequest` / `queryClient`.
- Riesgos corregidos:
  - 401 en loop por múltiples fetches => guard de logout único (`unauthorizedHandled`).
  - Sesiones zombies con STT => cleanup central y cierre explícito de `MediaRecorder`/tracks.
  - Requests colgadas => `AbortController` central para cancelar al cerrar sesión/pestaña.
- Endpoints potencialmente largos revisados: `/api/ai/stt`, `/api/pdfs/*`, uploads.
- Códigos de expiración estandarizados backend: `TOKEN_REQUIRED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`.
