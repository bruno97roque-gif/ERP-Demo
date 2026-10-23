# Demo local ERP Floreria

Prototipo para mostrar los flujos del documento de arquitectura. Sin dependencias: solo Node 22+ (usa `node:sqlite`).

```bash
cd demo
node server.js
# abrir http://localhost:3000
```

Los datos viven en memoria y se reinician al reiniciar el servidor (usa `DB_FILE=erp.db node server.js` para persistir).

## Que probar

1. **POS:** vende un ramo y paga parcial. Queda como cuenta por cobrar y se crea una comanda.
2. **Produccion:** cambia a *Carlos (Produccion)* y termina la comanda: se descuentan los insumos segun la receta.
3. **Inventario:** revisa el libro de movimientos y el stock en vivo.
4. **Nuevo arreglo:** boton en el POS; crea producto y receta al vuelo (admin y ventas).
5. **Shopify:** crea un pedido (no toca stock) y luego marcalo pagado (descuenta). Reenvia el duplicado para ver la idempotencia.
6. **Reportes:** mas vendidos, ventas por vendedor y metas por vendedor (fijalas como administracion).
7. **Roles:** cambia de usuario arriba; las pestanas y permisos cambian.

Es una demo: sin login real, sin Postgres ni Docker. La implementacion final sigue `docs/ARCHITECTURE.md`.
