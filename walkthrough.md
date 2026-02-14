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
