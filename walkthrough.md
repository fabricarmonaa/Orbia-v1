# Walkthrough de pruebas manuales

## Sticky Settings Sidebar
- [ ] Ir a `/app/settings` en desktop (lg+).
- [ ] Abrir sección **Personalización** y hacer scroll largo.
- [ ] Verificar que el menú lateral quede arriba y fijo (`sticky`) mientras el contenido de la derecha scrollea.
- [ ] Cambiar entre tabs mientras estás scrolleado y confirmar que el menú sigue alineado arriba.
- [ ] En mobile: verificar que el menú no se superpone, no se corta y mantiene usabilidad.

## STT end-to-end test
### Inventario de flujo
- Frontend: `client/src/components/voice-command.tsx` (grabación `MediaRecorder`, base64, envío a `/api/ai/stt`, muestra transcripción e intent).
- Backend: `server/routes/stt.ts` + `server/middleware/stt-guards.ts` (rate limit, concurrencia, validación de payload, logging debug, apply intent).
- AI service: `ai-service/main.py` (endpoint `/api/stt`, transcripción por subprocess + parser de intent por contexto).

### Configuración sugerida de entorno (dev)
- `STT_DEBUG=true` (backend + ai-service logs detallados)
- `AI_SERVICE_URL=http://localhost:8001`
- `STT_TIMEOUT_MS=30000`
- `STT_RETRY_ON_FAILURE=true` (opcional)
- `STT_MAX_BASE64_BYTES=2000000`

### Casos manuales obligatorios
- [ ] Dictado corto: “registrar gasto fijo alquiler 50000”.
- [ ] Dictado mediano con ruido: “pedido Juan Pérez, 2 empanadas…”.
- [ ] Dictado con pausa/silencio.

### Verificaciones por caso
- [ ] UI muestra estado “Transcribiendo…” mientras procesa.
- [ ] Si éxito: se ve transcripción + datos detectados + acción aplicable.
- [ ] Si falla: mensaje humano (“No se pudo transcribir…”) sin stack trace.
- [ ] Backend logs (con `STT_DEBUG=true`): entrada audio (bytes/duración estimada), respuesta IA, errores mapeados.
- [ ] Medir tiempo de respuesta aproximado y anotar si supera timeout.

## Productos: filtros + paginación
- [ ] Abrir Productos y validar layout final: sidebar de filtros + tabla principal.
- [ ] Aplicar búsqueda, categoría y estado (Activo/Inactivo/Todos) y confirmar resultados.
- [ ] Probar precio mínimo/máximo y stock (con stock / sin stock / bajo stock).
- [ ] Validar paginación (anterior/siguiente) y contador "Mostrando N de M".

## Selección + exportación PDF
- [ ] Seleccionar productos de la página actual y validar contador de selección.
- [ ] Usar "Seleccionar todo (filtrado)" y validar que persiste en refresh (localStorage tenant).
- [ ] Exportar "PDF con filtrados" y confirmar contenido según filtros.
- [ ] Exportar "PDF con seleccionados" y confirmar que solo incluye seleccionados.
- [ ] Validar mensajes amigables: selección vacía, sin resultados y exceso por límite de exportación.

## CRUD de productos
- [ ] Crear producto desde "Nuevo producto".
- [ ] Editar producto (nombre/precio/categoría/etc.).
- [ ] Activar/desactivar producto.
- [ ] Eliminar producto (confirmación + marcado inactivo).

## Stock por modo de tenant
- [ ] Tenant sin sucursales: crear/editar con stock global y costo; ver `stockTotal` correcto.
- [ ] Tenant con sucursales: ver total de stock y detalle por sucursal desde la tabla.
- [ ] Confirmar que en modo sucursales el formulario no edita stock global.

## Fix backend GET /api/products
- [ ] Probar `GET /api/products?status=active`, `status=ACTIVE`, `status=all` y `state=active`.
- [ ] Probar `minPrice`/`maxPrice` vacíos y `stock=low&lowStockThreshold=5`.
- [ ] Confirmar 200 con payload `{ data, meta }` cuando parámetros son válidos.
- [ ] Confirmar 400 (no 500) con `{ error, code }` cuando un parámetro es inválido.


## PDFs por plan (watermark)
- [ ] Tenant con plan **ECONOMICO**: exportar lista PDF y verificar watermark ORBIA en esquina inferior izquierda.
- [ ] Tenant con plan **PROFESIONAL** o **ESCALA**: exportar lista PDF y verificar que NO aparece watermark ORBIA.
- [ ] Verificar que el watermark no tapa contenido (tamaño pequeño y baja opacidad).


## WhatsApp CTA (Mejorar plan)
- [ ] Ir a Configuración → Plan y Suscripción.
- [ ] Click en “Mejorar plan”.
- [ ] Verificar apertura de `https://wa.me/5492236979026?...` en nueva pestaña.
- [ ] Verificar que el texto incluya el código real del negocio.

## Avatar editable (perfil usuario)
- [ ] Ir a Configuración → Cuenta.
- [ ] Subir imagen válida (<2MB) y confirmar actualización inmediata.
- [ ] Verificar avatar actualizado en sidebar (cache-busting con `?v=`).
- [ ] Probar archivo inválido/pesado y validar mensaje humano.

## Gating por plan (Económico / Profesional / Escala)
- [ ] ECONOMICO: sin links tracking externos, sin gastos definiciones, sin resumen mensual, sin Factura B.
- [ ] PROFESIONAL: sin Sucursales, sin STT, sin Factura B.
- [ ] ESCALA: Sucursales + STT + Factura B habilitados.
- [ ] En bloqueos server-side, validar `code=PLAN_BLOCKED` y mensaje humano.

## Session lifecycle & graceful shutdown
### Inventario rápido de sesión
- Token: se guarda en `localStorage` (`orbia_token`, `orbia_user`) y se adjunta en `Authorization` desde `client/src/lib/auth.ts`.
- Manejo global de 401: `apiRequest` y `queryClient` detectan `TOKEN_EXPIRED|TOKEN_INVALID|TOKEN_REQUIRED` y disparan logout centralizado una sola vez.
- Recursos vivos observados: `MediaRecorder` (dictado), requests en vuelo (`AbortController`), listeners de online/offline y cierre de pestaña.
- Endpoint de salida: `POST /api/auth/logout` (best-effort, rápido, devuelve `{ ok: true }`).

### Casos manuales
- [ ] **Logout normal con STT activo**: iniciar dictado, cerrar sesión, verificar que se corta micrófono, no hay requests pendientes y redirige a login.
- [ ] **Token expirado**: usar token vencido, disparar request, validar redirección única a login con mensaje de sesión expirada.
- [ ] **Cerrar pestaña (Alt+F4)**: con STT o PDF preview en curso, cerrar pestaña y validar ausencia de spam/loops.
- [ ] **Offline/Online**: desconectar internet, validar pausa sin loops; reconectar y confirmar recuperación sin ráfaga de requests.

## PWA multi-panel (Tenant / Delivery / Owner)
- [ ] Abrir `/app` y verificar en Chrome DevTools > Application que `manifest-tenant.json` está activo (name: **Orbia**, `start_url:/app`, `scope:/app`).
- [ ] Abrir `/delivery` y verificar `manifest-delivery.json` (name: **Orbia Delivery**, `start_url:/delivery`, `scope:/delivery`).
- [ ] Abrir `/owner` (o `/super`) y verificar `manifest-owner.json` (name: **Orbia Admin**, `start_url:/owner`, `scope:/owner`).
- [ ] Instalar cada panel y validar nombre/ícono correctos y apertura dentro del scope.

## SuperAdmin hardening (allowlist + lockout + 2FA + credenciales)
- [ ] Configurar `SUPERADMIN_IP_ALLOWLIST` y `TRUST_PROXY` (si aplica), probar login super desde IP fuera de lista y validar `403 SUPERADMIN_IP_BLOCKED`.
- [ ] Forzar intentos fallidos de login super hasta lockout y validar `429 SUPERADMIN_LOCKED` + `secondsRemaining`.
- [ ] Desde Owner > Seguridad: ejecutar `Configurar 2FA`, escanear QR con **Google Authenticator**, verificar token y re-login con `totpCode` requerido.
- [ ] Intentar login sin TOTP con 2FA activo y validar `SUPERADMIN_2FA_REQUIRED`.
- [ ] Cambiar email/contraseña de superadmin con contraseña actual y validar login con nuevas credenciales.
- [ ] Probar contraseña nueva débil y validar rechazo humano por política de seguridad.
