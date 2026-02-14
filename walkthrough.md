# Walkthrough de pruebas manuales

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
