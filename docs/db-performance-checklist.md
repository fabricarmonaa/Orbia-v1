# DB performance checklist

## 1) Verificación de índices por tabla

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN (
  'products','orders','cash_sessions','cash_movements','expense_definitions','branches','users',
  'tenant_daily_metrics','tenant_monthly_metrics','idempotency_keys'
)
ORDER BY tablename, indexname;
```

## 2) EXPLAIN ANALYZE - endpoints pesados

### Products list filtrado
```sql
EXPLAIN ANALYZE
SELECT id, tenant_id, category_id, is_active, created_at
FROM products
WHERE tenant_id = 1
  AND is_active = true
  AND (category_id = 2 OR category_id IS NULL)
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

### Orders list por tenant + estado
```sql
EXPLAIN ANALYZE
SELECT id, tenant_id, status_id, created_at
FROM orders
WHERE tenant_id = 1
  AND status_id = 3
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

### Cash movements por tenant + fecha
```sql
EXPLAIN ANALYZE
SELECT id, tenant_id, session_id, created_at, amount, type
FROM cash_movements
WHERE tenant_id = 1
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC
LIMIT 100;
```

## 3) Smoke test de refresh metrics

```bash
curl -X POST http://localhost:5000/api/reports/metrics/refresh \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"from":"2026-02-01","to":"2026-02-15"}'
```

Esperado:
- `200 { "ok": true, "code": "METRICS_REFRESHED" }`

## 4) Leer métricas mensuales

```bash
curl "http://localhost:5000/api/reports/metrics/monthly?month=2026-02-01" \
  -H "Authorization: Bearer <TOKEN>"
```

Esperado:
- `200 { data: { month, ordersCount, revenueTotal, ordersCancelledCount, cashInTotal, cashOutTotal } }`
- fallback en cero si no hay filas.

## 5) Idempotencia (operaciones críticas)

### Crear orden con key
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-order-001" \
  -d '{"customerName":"Cliente A","totalAmount":1200}'
```

Repetir mismo request con misma key => debe devolver resultado previo.

