# Security Audit Backend (DevTools/Postman tampering)

Fecha: 2026-02-15

## Criterio
- **PASS**: endpoint con auth/tenant-scope/rol/feature-gating y validación suficiente.
- **FAIL**: faltan guards o hay riesgo claro de IDOR/tampering.

## Inventario de endpoints

| Método | Ruta | Público/Privado | Auth middleware | Rol requerido | Plan/Addon | Zod/validación | Recursos | Riesgo IDOR | Estado |
|---|---|---|---|---|---|---|---|---|---|
| POST | /api/auth/login | Público | rate-limit login | N/A | N/A | zod login | users/tenants | Bajo | PASS |
| POST | /api/auth/super/login | Público restringido | rate-limit + IP allowlist + lockout | super | N/A | zod + 2FA opcional | super admin | Bajo | PASS |
| POST | /api/auth/logout | Privado best-effort | token opcional | user | N/A | N/A | audit | Bajo | PASS |
| GET/POST/PATCH/DELETE | /api/super/* | Privado | superAuth | superadmin | N/A | zod parcial | tenants/plans/addons/security | Bajo | PASS |
| GET | /api/me, /api/me/plan, /api/tenant/info | Privado | tenantAuth | tenant user | N/A | parcial | users/tenants/plans | Bajo | PASS |
| PUT | /api/me/profile | Privado | tenantAuth | tenant user (self) | N/A | validación campo | users | Bajo | PASS |
| GET/PUT | /api/config | Privado | tenantAuth + requireTenantAdmin(put) | admin (put) | límites plan | zod config | config | Medio (tampering payload) | PASS |
| GET | /api/dashboard/stats | Privado | tenantAuth + enforceBranchScope | tenant/branch | N/A | N/A | orders/products/cash | Medio | PASS |
| GET/PUT | /api/branding/tenant | Privado | tenantAuth (+admin put) | admin put | plan-aware | zod parcial | branding | Bajo | PASS |
| GET/PUT | /api/branding/app | público(super put) | superAuth (put) | super | N/A | parcial | app branding | Bajo | PASS |
| GET/PUT/POST | /api/pdfs/settings* | Privado | tenantAuth (+admin writes) | admin writes | plan feature/gating | zod settings | pdf settings | Medio | PASS |
| POST/GET | /api/pdfs/preview/download* | Privado | tenantAuth + rate-limit | tenant user | invoice_b plan gating | zod payload | pdf render | Medio | PASS |
| GET/POST/PATCH/PUT/DELETE | /api/products* | Privado | tenantAuth + requireFeature(products) + admin en writes | admin writes | products feature | zod | products/stock | Medio | PASS |
| GET/POST/PATCH | /api/orders* | Privado | tenantAuth + enforceBranchScope | tenant/branch | N/A | zod create/status/comment | orders/history | Medio | PASS |
| GET/POST/PATCH | /api/cash* | Privado | tenantAuth (+feature en sessions) + enforceBranchScope | tenant/branch | features cash_* | zod movement + branch ownership check | cash/session | Medio | PASS |
| GET/POST/DELETE | /api/branches* | Privado | tenantAuth + requireTenantAdmin + requireFeature(branches)+plan ESCALA | admin | branches/ESCALA | validaciones internas | branches | Bajo | PASS |
| GET/POST/PATCH/DELETE | /api/branch-users* | Privado | tenantAuth + requireTenantAdmin + requireFeature(branches)+plan ESCALA | admin | branches/ESCALA | validaciones + tenant checks | users | Bajo | PASS |
| GET/POST/PATCH/DELETE | /api/expenses* /fixed-expenses* | Privado | tenantAuth + requireTenantAdmin writes + feature/plan guards | admin writes | not ECONOMICO, fixed_expenses feature | zod strict | expenses | Medio | PASS |
| POST/GET | /api/reports/* | Privado | tenantAuth (+requireTenantAdmin en summary/refresh) | admin summary/refresh | not ECONOMICO | zod | reports/metrics | Bajo | PASS |
| POST | /api/uploads/tenant-logo | Privado | tenantAuth + requireTenantAdmin | admin | N/A | upload-guards | files/branding | Bajo | PASS |
| POST | /api/uploads/avatar | Privado | tenantAuth | self | N/A | upload-guards | files/users | Bajo | PASS |
| POST | /api/uploads/app-logo | Privado | superAuth | super | N/A | upload-guards | app files | Bajo | PASS |
| POST | /api/ai/stt | Privado | tenantAuth + requireFeature(stt)+plan ESCALA + rate/concurrency/payload guards | tenant | stt/ESCALA | validator + timeout | stt logs/ai | Medio | PASS |
| POST | /api/ai/apply | Privado | tenantAuth + requireFeature(stt)+plan ESCALA + enforceBranchScope | tenant | stt/ESCALA | payload checks + branch ownership | orders/cash/products | Medio | PASS |
| GET | /api/public/tracking/:trackingId | Público | none | N/A | N/A | expiración/revocado | tracking public view | Medio (enumeración trackingId) | PASS (aceptado por diseño) |
| POST | /api/delivery/auth/login | Público | credential check | delivery agent | addon delivery | validaciones input | delivery agents | Medio | PASS |
| GET/POST/PATCH/DELETE | /api/delivery/agents/action-states/routes/orders | Privado | tenantAuth + requireTenantAdmin + blockBranchScope + requireAddon(delivery) | admin | addon delivery | zod parcial | delivery config | Bajo | PASS |
| GET/POST | /api/delivery/routes/* (agent) | Privado | deliveryAuth | delivery agent | addon delivery | checks route ownership | delivery route/order | Medio | PASS |

## Cambios de hardening aplicados
1. **Branch-users** ahora exige backend feature-gating real (`branches` + plan `ESCALA`) en todos los endpoints.  
2. **Delivery tenant management** ahora exige `requireTenantAdmin + blockBranchScope` (no solo UI) y validación zod para payloads de agentes/estados.  
3. **Cash & Orders** agregan validación de ownership de `branchId` antes de operar (evita parameter tampering con branch ajena).  
4. **STT apply** valida payload, normaliza errores y valida que `branchId` exista dentro del tenant.  
5. **Expenses writes** endurecidos a `requireTenantAdmin` + zod strict (categorías y gastos fijos).  
6. **Info leak frontend**: sanitización de mensajes para evitar render de rutas locales/stack frames (`C:/Users/...`, stack traces) hacia usuario final.
7. **Errores 500**: se evitó exponer `err.message` crudo en múltiples rutas, usando mensaje genérico + `code`.

## Pruebas manuales reproducibles (curl/Postman)
> Reemplazar tokens/ids por valores reales.

### 1) Sin token => 401
```bash
curl -i http://localhost:5000/api/products
```
Esperado: `401` con `{ error, code }`.

### 2) User no-admin intentando endpoint admin => 403
```bash
curl -i -H "Authorization: Bearer $USER_TOKEN" http://localhost:5000/api/branch-users
```
Esperado: `403` con `PERMISSION_DENIED`/mensaje humano.

### 3) Plan bloqueado (ej. branches en plan no ESCALA) => 403
```bash
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:5000/api/branches
```
Esperado: `403` `FEATURE_BLOCKED` + `upgradeUrl`.

### 4) IDOR por id de otro tenant => 404/403
```bash
curl -i -X PATCH \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}' \
  http://localhost:5000/api/branch-users/999999
```
Esperado: `404` o `403`, nunca modificación cruzada.

### 5) Tampering de branchId en cash/order => bloqueo
```bash
curl -i -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"ingreso","amount":1000,"branchId":999999}' \
  http://localhost:5000/api/cash/movements
```
Esperado: `404 BRANCH_NOT_FOUND`.

### 6) STT apply con branchId inválida => bloqueo
```bash
curl -i -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context":"orders","intent":{"action":"create","branchId":999999}}' \
  http://localhost:5000/api/ai/apply
```
Esperado: `404 BRANCH_NOT_FOUND`.

## Checklist final
- [x] Auth server-side en rutas privadas
- [x] Gating por plan/addon en backend (no UI)
- [x] Controles anti-IDOR en rutas sensibles con `:id`
- [x] Zod strict agregado en payloads críticos
- [x] Sin exposición de rutas locales/stack en mensajes al usuario
