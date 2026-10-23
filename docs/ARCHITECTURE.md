# ERP Florería — Arquitectura

Estado: propuesta v0.1 (para validar en las sesiones de levantamiento con ventas y operaciones).

## 0. Decisiones confirmadas con el cliente

| Tema | Decisión |
|---|---|
| Bonos | El administrador define **montos de venta a alcanzar por vendedor** (por periodo). El sistema muestra avance y cumplimiento; no calcula comisiones por reglas complejas. |
| Recetas | **Fijas** por producto. Consumo de insumos = receta, sin override del florista. |
| Arreglos nuevos | Usuarios autorizados pueden **crear un arreglo nuevo (con su receta) en el momento** y queda listado en el catálogo del ERP, disponible en POS. |
| Bodegas | **Una sola bodega** por ahora. El modelo conserva `location` para crecer, pero la UI no la expone. |
| Shopify | El stock se descuenta **al pagarse** el pedido (`orders/paid`), no al crearse. |
| Facturación | **Fuera de alcance** (no está en el presupuesto). El ERP emite solo un *ticket de venta no fiscal*. Se deja el modelo preparado (datos de cliente: documento, razón social) para integrar un facturador después. |
| Pagos | Suposición: **Culqi**. Ver nota abajo sobre cobro presencial vs. en línea. |
| Impresión | Suposición: **impresora térmica** de 80 mm para tickets y comandas. |
| Quién crea arreglos | **Administración y ventas** (producción no). |

**Pagos (Culqi).** Culqi es una pasarela de cobro en línea. Para el POS en tienda, el cobro con tarjeta normalmente se hace en un terminal físico aparte, y el cajero registra el pago en el ERP. Diseño: `payment.method` (`CASH | CARD | YAPE_PLIN | TRANSFER | CULQI | OTHER`) más `reference` (código de operación). La integración directa con la API de Culqi (link de pago para pedidos por teléfono o WhatsApp, con webhook que marca el pedido como pagado) queda como módulo opcional de la fase 4. Esto está por confirmar.

**Impresión térmica.** Fase inicial: ticket con CSS para 80 mm impreso desde el navegador (`window.print`), sin software extra. Mejora posible: agente local ESC/POS para impresión directa, apertura de cajón y corte automático. La comanda de producción se imprime con el mismo mecanismo (opcional, ya que existe la pantalla digital).

## 1. Principios

1. **Monolito modular.** Una sola aplicación desplegable, dividida en módulos con fronteras claras. Un VPS de un cliente no justifica microservicios.
2. **Inventario como libro de movimientos.** El stock nunca se edita: se calcula sumando movimientos. Da trazabilidad, auditoría y base para mermas.
3. **Propiedad del cliente.** Todo corre en Docker Compose sobre un VPS a nombre del cliente. Sin servicios propietarios obligatorios. Stack open source.
4. **Tiempo real donde importa.** Stock y comandas se actualizan en vivo (WebSocket/SSE); reportes pueden ser por consulta.
5. **Idempotencia en integraciones.** Shopify reintenta webhooks; el ERP nunca debe descontar dos veces.

## 2. Stack propuesto

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend | Node.js + TypeScript + NestJS | Módulos nativos, DI, validación, fácil de mantener |
| ORM | Prisma | Migraciones versionadas, tipos |
| Base de datos | PostgreSQL 16 | Transacciones, restricciones, vistas para reportes |
| Frontend | React + Vite + TypeScript, Tailwind | POS rápido, SPA única con rutas por rol |
| Tiempo real | Server-Sent Events (o WebSocket) | Comandas y stock en vivo |
| Cola de trabajos | pg-boss (sobre Postgres) | Reintentos de Shopify sin añadir Redis |
| Gráficos | Recharts | Gráficos automáticos y proyecciones |
| Proxy / TLS | Caddy | HTTPS automático con Let's Encrypt |
| Despliegue | Docker Compose | Reproducible, simple de entregar al cliente |

> Alternativa si el equipo prefiere Python: Django + DRF cubre admin, permisos y ORM de fábrica. La arquitectura lógica de abajo no cambia.

## 3. Vista general

```
                Internet
                   │
            ┌──────▼──────┐
            │    Caddy    │  HTTPS, compresión
            └──────┬──────┘
        ┌──────────┴───────────┐
        │                      │
  ┌─────▼─────┐         ┌──────▼───────┐
  │ Frontend  │         │   API (Nest) │◄──── Webhooks Shopify
  │ React SPA │  REST   │  módulos ERP │────► Shopify Admin API
  └───────────┘  + SSE  └──────┬───────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
           ┌─────▼────┐  ┌─────▼─────┐ ┌─────▼──────┐
           │PostgreSQL│  │ pg-boss   │ │ Backups    │
           │          │  │ (jobs)    │ │ pg_dump→S3 │
           └──────────┘  └───────────┘ └────────────┘
```

Contenedores: `caddy`, `web` (estáticos), `api`, `db`. El worker de jobs corre dentro de `api` (o como segundo proceso del mismo imagen).

## 4. Módulos del backend

```
src/
  auth/            usuarios, roles, permisos, sesiones
  catalog/         productos, insumos, recetas (BOM), precios
  inventory/       ubicaciones, lotes, libro de movimientos, stock
  sales/           ventas, líneas, pagos, clientes
  pos/             cajas, turnos, cierre diario
  production/      órdenes de producción (comandas)
  waste/           mermas
  finance/         cuentas por cobrar, pagos, resumen de ingresos
  reports/         vistas y consultas agregadas, proyecciones
  integrations/
    shopify/       webhooks, mapeo SKU, sincronización
  common/          auditoría, eventos de dominio, utilidades
```

Regla de dependencia: los módulos se hablan por **servicios exportados y eventos de dominio**, no leyendo tablas ajenas. Ejemplo: `sales` emite `SaleConfirmed`; `inventory` y `finance` reaccionan.

## 5. Modelo de datos (núcleo)

### Catálogo
- `item` — todo lo que tiene stock o se vende. `kind`: `SUPPLY` (insumo: flor, listón, papel), `PRODUCT` (arreglo terminado), `RESALE` (peluche, chocolate).
- `item.unit`: `unit | stem | meter | gram` (cantidades exactas con `numeric(14,3)`).
- `recipe` / `recipe_line` — receta **fija** de un producto: cuántos insumos consume. Permite descuento automático al producir. Las recetas se versionan (`version`, `active`): editar una receta crea una versión nueva y las órdenes ya creadas conservan la suya.
- **Creación de arreglos al vuelo:** flujo "Nuevo arreglo" (desde catálogo o desde el POS) que en una sola transacción crea `item (kind=PRODUCT)` + `recipe` + precio. Permiso `catalog.create_product`; por defecto `ADMIN` y `SALES`. Queda `created_by` y entra al `audit_log`. Si algún insumo de la receta no existe, se puede crear desde el mismo formulario.
- `shopify_variant_map` — `shopify_variant_id → item_id`.

### Inventario (libro de movimientos)
- `stock_movement(id, item_id, location_id, qty, type, ref_type, ref_id, user_id, created_at)`
  - `qty` firmado (+ entra, − sale).
  - `type`: `PURCHASE_IN | SALE_OUT | PRODUCTION_CONSUME | PRODUCTION_OUTPUT | WASTE | ADJUSTMENT | SHOPIFY_OUT | RETURN`.
- `stock_level(item_id, location_id, qty)` — tabla de saldo actualizada **en la misma transacción** que el movimiento (con `CHECK (qty >= 0)` configurable por ítem). Es lo que lee la UI en tiempo real.
- Opcional fase 2: `lot` con fecha de ingreso/caducidad para flor fresca (FEFO).

### Ventas y caja
- `customer`, `sale(id, source: POS|SHOPIFY|PHONE, status, seller_id, register_id, total, ...)`, `sale_line`, `payment(method, amount, ...)`.
- `cash_register`, `cash_session(opened_by, opened_at, opening_float, closed_at, counted_cash, expected_cash, difference)` → **cierre de caja diario**.

### Producción
- `production_order(id, sale_line_id?, product_item_id, qty, status, assigned_to, due_at, notes)`
  - Estados: `PENDING → IN_PROGRESS → DONE | CANCELLED`.
  - Al pasar a `DONE` genera `PRODUCTION_CONSUME` por cada línea de la receta (versión congelada en la orden).
  - Si se desperdicia material durante la producción, se registra aparte como merma (`PRODUCTION_ERROR`), no modificando la receta.

### Mermas
- `waste_record(item_id, qty, reason, location_id, user_id, notes, created_at)` con `reason` catálogo: `WILTED | DAMAGED | EXPIRED | PRODUCTION_ERROR | OTHER`. Genera un `stock_movement` tipo `WASTE`.

### Metas de venta (bonos)
- `sales_goal(id, seller_id, period_type: MONTH|QUARTER|YEAR|CUSTOM, period_start, period_end, target_amount, set_by, created_at)`.
- Solo `ADMIN` crea/edita metas. Avance = suma de `sale.total` pagadas del vendedor en el periodo (excluye anuladas/devueltas), calculado por consulta.
- Pantalla: tabla por vendedor con meta, vendido, % de avance, faltante y estado `ALCANZADA / EN CURSO / NO ALCANZADA`. El vendedor ve solo su propio avance.

### Finanzas
- `receivable(sale_id, customer_id, amount, due_date, status)` y `payment` aplicables a una o varias cuentas.
- Estado de pago del pedido derivado: `UNPAID | PARTIAL | PAID`.

### Usuarios
- `user`, `role`, `permission`, `user_role`. Roles iniciales: `ADMIN`, `SALES`, `PRODUCTION`. Permisos granulares por módulo/acción (`sales.create`, `inventory.adjust`, `reports.view`, …).
- `audit_log(user_id, action, entity, entity_id, before, after, at)` para ajustes, anulaciones y cierres.

## 6. Flujos críticos

### 6.1 Venta en POS
1. Cajero abre `cash_session`.
2. Crea `sale` con líneas y pagos → transacción única.
3. Si el ítem es `RESALE`: descuenta stock inmediato (`SALE_OUT`).
4. Si es `PRODUCT` bajo pedido: crea `production_order` (comanda digital) y el stock de insumos se descuenta al producir.
5. Si hay saldo pendiente: crea `receivable`.

### 6.2 Comanda digital
- Pantalla de producción con tablero (Pendiente / En proceso / Listo) en vivo por SSE; reemplaza la comanda física.
- Al completar: consume insumos según receta (o real), registra diferencia como merma opcional.

### 6.3 Shopify → ERP
1. Webhooks `orders/create`, `orders/paid`, `orders/cancelled` y `refunds/create` llegan a `/integrations/shopify/webhook`. `orders/create` solo registra el pedido (`sale` en estado `PENDING_PAYMENT`, sin tocar stock); **`orders/paid` es el que descuenta**.
2. **Verificar HMAC** con el secreto de la app. Rechazar si falla.
3. Guardar el payload crudo en `shopify_event(id_shopify, topic, payload, status)` con **unique** sobre `X-Shopify-Webhook-Id` → idempotencia.
4. Encolar job; el job mapea variantes con `shopify_variant_map`; al pagarse, descuenta stock (`SHOPIFY_OUT`) para `RESALE` o genera `production_order` para `PRODUCT`. Riesgo asumido: entre crear y pagar no hay reserva, así que dos pedidos podrían competir por el último insumo; si el stock queda negativo se marca `NEEDS_ATTENTION`. Reservas quedan como mejora futura.
5. SKUs sin mapeo → evento en estado `NEEDS_ATTENTION` y alerta en el panel de admin (no se pierde el pedido).
6. Reconciliación nocturna: job que consulta la Admin API y compara pedidos de las últimas 48 h para atrapar webhooks perdidos.
7. Opcional (fase 2): empujar stock del ERP a Shopify (`inventory_levels/set`) para evitar sobreventa.

### 6.4 Cierre de caja
Esperado = fondo inicial + ventas en efectivo − egresos. El cajero ingresa el conteo; el sistema guarda la diferencia y bloquea nuevas ventas en esa sesión. Genera el resumen del día.

## 7. Reportes y estadísticas

Vistas SQL (y vistas materializadas para periodos grandes) alimentadas por `sale`, `sale_line`, `payment`:
- Productos más vendidos por mes / por año.
- Ventas por periodo y **por vendedor**, junto con el avance contra `sales_goal` (metas de bono).
- Ingresos vs. cuentas por cobrar.
- Mermas por insumo y motivo.
- **Proyecciones:** inicio simple (media móvil / tendencia lineal sobre ventas mensuales, estacionalidad por fechas clave: San Valentín, Día de la Madre). Se mejora con histórico acumulado.

## 8. Seguridad

- Autenticación con JWT de corta vida + refresh token en cookie `HttpOnly`; contraseñas con argon2.
- Autorización por rol y permiso en un guard global; el frontend solo oculta, el backend decide.
- HTTPS obligatorio, CORS restringido, rate limiting en login y webhooks.
- Secretos en `.env` fuera del repositorio; el cliente conserva el control.
- Auditoría de operaciones sensibles (anular venta, ajuste de stock, cierre de caja).
- Backups diarios de Postgres cifrados + prueba de restauración documentada.

## 9. Despliegue en VPS

- Requisitos orientativos: 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu LTS.
- `docker compose up -d` con volúmenes para Postgres y backups.
- CI en GitHub Actions: lint, tests, build de imágenes. Despliegue por `git pull` + `docker compose pull && up -d`, con migraciones automáticas al arrancar.
- Entregables al cliente: código fuente completo, `README` de operación, runbook de backup/restore, accesos del VPS y de la cuenta de GitHub a su nombre.

## 10. Estructura del repositorio

```
ERP-Demo/
  apps/
    api/          NestJS
    web/          React + Vite
  packages/
    shared/       tipos y esquemas compartidos (zod)
  infra/
    docker-compose.yml
    Caddyfile
    backup/
  docs/
    ARCHITECTURE.md
  .github/workflows/
```

## 11. Plan por fases

| Fase | Contenido |
|---|---|
| 0 | Levantamiento, validar este documento, catálogo real de insumos y recetas |
| 1 | Auth y roles, catálogo, inventario (movimientos + stock en vivo) |
| 2 | POS, caja y cierre diario |
| 3 | Producción (comandas digitales) y mermas |
| 4 | Finanzas y cobranza |
| 5 | Integración Shopify (webhooks, mapeo, reconciliación) |
| 6 | Reportes, gráficos y proyecciones |
| 7 | Hardening, backups, despliegue en VPS del cliente, capacitación |

## 12. Preguntas abiertas para el levantamiento

Resueltas o asumidas (ver sección 0): bonos, recetas fijas, arreglos nuevos, una bodega, descuento al pagarse, sin facturación, quién crea arreglos. Pendientes:

1. ¿Se necesita control por lote y caducidad de flor fresca?
2. ¿El cobro con tarjeta en tienda es por terminal físico o se usará Culqi también presencialmente? ¿Se quiere link de pago para pedidos por teléfono? ¿Se aceptan Yape/Plin y transferencias?
3. ¿Marca y modelo de la impresora térmica? ¿Hay cajón de dinero o lector de códigos?
4. ¿Las metas de venta son mensuales, anuales o por periodos libres? ¿Ven los vendedores su avance?
5. ¿Volumen aproximado de pedidos diarios y picos (fechas especiales)?
6. ¿Idioma, moneda e impuestos (un solo país/IVA)? (Culqi sugiere Perú: PEN e IGV, por confirmar)
7. ¿El cliente tiene ya VPS/proveedor preferido?
