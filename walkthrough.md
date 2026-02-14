# Walkthrough de pruebas manuales

## Productos + PDF filtros/selección
- [ ] Crear 30 productos y deshabilitar 5.
- [ ] Aplicar filtro `Estado = Activo` y exportar PDF filtrado. Verificar que no aparezcan los 5 inactivos.
- [ ] Aplicar filtro por categoría y exportar PDF filtrado. Verificar que solo salgan productos de esa categoría.
- [ ] Seleccionar 3 productos al azar y exportar "PDF con seleccionados". Verificar que salgan solo esos 3.

## Stock con/sin sucursales
- [ ] Tenant sin sucursales: crear/editar producto con `stock` global y validar que se vea en UI (`stockTotal`) y en PDF.
- [ ] Tenant con sucursales: cargar stock por sucursal y validar que `stockTotal` sea la suma.
- [ ] Si setting PDF `showBranchStock = true`, validar que el PDF incluya desglose por sucursal.

## UX y hardening
- [ ] Preview PDF en Configuración no debe mostrar error CSP.
- [ ] Download PDF debe funcionar autenticado (sin 401 por link directo).
- [ ] Upload de logo grande debe mostrar mensaje humano (no JSON crudo).
- [ ] Navegar a ruta inexistente y ver página 404.
- [ ] En detalle de sucursal, validar que exista acción directa de "Eliminar sucursal".
