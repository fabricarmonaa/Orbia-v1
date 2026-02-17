# Backend DB finalization plan

## 1) Inventario de tablas y relaciones (multi-tenant)

Tablas core con `tenant_id`:
- `tenants` (raíz de negocio)
- `users` (FK lógica a tenant, soft-delete con `deleted_at`)
- `branches` (tenant + soft-delete)
- `orders`, `order_statuses`, `order_status_history`, `order_comments`
- `cash_sessions`, `cash_movements`, `expense_definitions`, `fixed_expenses`, `expense_categories`
- `products`, `product_categories`, `product_stock_by_branch`, `stock_movements`
- `tenant_branding`, `tenant_pdf_settings`, `tenant_addons`, `tenant_monthly_summaries`, `stt_logs`, `audit_logs`

Relaciones principales:
- `orders.tenant_id -> tenants.id`
- `cash_movements.session_id -> cash_sessions.id`
- `products.category_id -> product_categories.id`
- `product_stock_by_branch.product_id -> products.id`, `branch_id -> branches.id`
- `users.tenant_id -> tenants.id`

## 2) Riesgos detectados

- Índices compuestos insuficientes para listados filtrados:
  - productos (tenant + categoría + activo + fecha)
  - pedidos (tenant + estado + fecha)
  - caja (tenant + fecha + session)
- Falta de tabla de idempotencia para operaciones críticas (`create order`, `create cash movement`, `close cash session`).
- Métricas de dashboard/reportes calculadas on-demand con sumatorias directas -> costo creciente por tenant.
- Errores backend no uniformes en múltiples rutas (mezcla de `{error}` y `{error, code}`).

## 3) Migraciones a crear

1. `migrations/20260215_backend_finalization.sql`
   - Índices compuestos multi-tenant.
   - Unique por tenant para SKU (cuando no es null/vacío).
   - Tablas de resumen:
     - `tenant_daily_metrics`
     - `tenant_monthly_metrics`
   - Tabla `idempotency_keys`.

## 4) Estrategia de métricas (elegida)

**Elegida: summary tables** (no materialized view).

Motivo:
- Update incremental barato por período afectado (día/mes).
- Más control para refresh parcial por tenant y rango.
- Menor complejidad operativa que `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

## 5) Servicio y refresh

- Nuevo servicio: `server/services/metrics-refresh.ts`
- API:
  - `refreshTenantMetrics(tenantId, { from?, to? })` recalcula solo rango afectado.
  - `refreshMetricsForDate(tenantId, date)` helper para eventos de escritura.
- Trigger por evento en backend:
  - al crear pedido
  - al crear movimiento de caja
  - al cerrar caja
- Endpoint manual protegido:
  - `POST /api/reports/metrics/refresh` (tenant admin)
  - rate limit fuerte

## 6) Checklist final

- [ ] `tenant_id` aplicado y filtrado en queries sensibles.
- [ ] Índices compuestos creados y verificados.
- [ ] Unique SKU por tenant validado.
- [ ] Summary tables activas + refresh incremental funcionando.
- [ ] Endpoint manual de refresh protegido y rate-limited.
- [ ] Idempotencia activa en operaciones críticas.
- [ ] Errores uniformes `{ error, code }` en rutas modificadas.
- [ ] `npm run check` en verde.
