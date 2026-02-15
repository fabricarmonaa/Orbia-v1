# UI Branding por panel (favicon, PWA, títulos)

## Ubicación de íconos
Los íconos de cada panel se usan en:

- `client/public/icons/tenant/`
- `client/public/icons/delivery/`
- `client/public/icons/admin/`

Archivos esperados por panel:
- `favicon.ico` (navegador)
- `icon-180.png` (Apple touch)
- `icon-192.png` (PWA)
- `icon-512.png` (PWA)

## ⚠️ Importante para GitHub PR (error "Los archivos binarios no se admiten")
En esta rama se dejaron **ignorados en Git** los binarios de iconos para que no bloqueen la creación del PR.

Se agregó en `.gitignore`:
- `client/public/icons/**/*.png`
- `client/public/icons/**/*.ico`

Esto evita subir binarios al PR, pero la app igual los sigue esperando en runtime/manifests.

## Qué tenés que poner localmente (paso a paso)
### 1) Tenant (`/app`)
Copiar estos archivos en:
- `client/public/icons/tenant/favicon.ico`
- `client/public/icons/tenant/icon-180.png` (**180x180**)
- `client/public/icons/tenant/icon-192.png` (**192x192**)
- `client/public/icons/tenant/icon-512.png` (**512x512**)

Recomendado usar:
- `uploads/dummy/orbia-logo.ico` para `favicon.ico`
- `uploads/dummy/nobg orbia logo.png` para derivar 180/192/512

### 2) Delivery (`/delivery`)
- `client/public/icons/delivery/favicon.ico`
- `client/public/icons/delivery/icon-180.png` (**180x180**)
- `client/public/icons/delivery/icon-192.png` (**192x192**)
- `client/public/icons/delivery/icon-512.png` (**512x512**)

Recomendado usar:
- `uploads/dummy/orbia-logo-delivery.ico`
- `uploads/dummy/orbia logo delivery.jpeg` (o versión sin fondo si la tenés)

### 3) Admin (`/owner`, `/super`)
- `client/public/icons/admin/favicon.ico`
- `client/public/icons/admin/icon-180.png` (**180x180**)
- `client/public/icons/admin/icon-192.png` (**192x192**)
- `client/public/icons/admin/icon-512.png` (**512x512**)

Recomendado usar:
- `uploads/dummy/orbia-logo-admin.ico`
- `uploads/dummy/orbia logo admin.jpeg` (o versión sin fondo si la tenés)

## Manifests PWA
Los manifests están en:
- `client/public/manifest-tenant.json`
- `client/public/manifest-delivery.json`
- `client/public/manifest-owner.json`

Cada uno define:
- `name` / `short_name`
- `start_url` y `scope`
- `icons` por panel (192/512)

## Cambio dinámico por ruta
El archivo `client/src/components/pwa-runtime.tsx` centraliza, según pathname:
- `document.title`
- `<link rel="manifest">`
- `<link rel="icon">` y `<link rel="shortcut icon">`
- `<link rel="apple-touch-icon">`
- `meta[name="theme-color"]`

Reglas de panel:
- `/app/*` => Tenant
- `/delivery/*` => Delivery
- `/owner/*` y `/super/*` => Admin

## Títulos por ruta
También en `pwa-runtime.tsx` se define el mapeo de títulos en español:
- `ORBIA - PANEL CENTRAL`
- `ORBIA - CONFIGURACIÓN`
- `ORBIA - PRODUCTOS`
- `ORBIA - PEDIDOS`
- `ORBIA - CAJA`
- `ORBIA - SUCURSALES`
- `ORBIA - DELIVERY`
- `ORBIA - ADMINISTRACIÓN`
- `ORBIA - SEGURIDAD`
- `ORBIA - NEGOCIOS`
