# ERP Florería — Arquitectura

Estado: propuesta v0.2. Rediseñada con criterio "Ponytail": **reusar antes que construir y escribir solo lo que la tarea necesita**. La validación, la seguridad, el manejo de errores y la accesibilidad no se recortan nunca.

## 0. Decisiones confirmadas con el cliente

| Tema | Decisión |
|---|---|
| Bonos | El administrador define **montos de venta a alcanzar por vendedor** por mes. El sistema muestra avance y cumplimiento; no calcula comisiones. |
| Recetas | **Fijas** por producto. Consumo de insumos = receta. |
| Arreglos nuevos | **Administración y ventas** pueden crear un arreglo con su receta en el momento; queda listado y disponible en el POS. |
| Bodegas | **Una sola bodega.** |
| Shopify | El stock se descuenta **al pagarse** el pedido (`orders/paid`). |
| Facturación | **Fuera de alcance.** Solo ticket de venta no fiscal. |
| Pagos | Suposición: **Culqi** para cobros en línea; en tienda el cajero registra método y código de operación. |
| Impresión | Suposición: **impresora térmica 80 mm**, impresión desde el navegador. |

## 1. Principios

1. **Reusar antes que construir.** Si un framework o librería madura ya lo resuelve (login, permisos, CRUD de back-office, migraciones, grilla editable, gráficos), se usa. Código propio solo para lo que es del negocio: POS, comandas, planillas de inventario, cobranza, reportes.
2. **Lo mínimo que funciona.** Nada "por si acaso": sin colas, sin eventos de dominio, sin multi-bodega ni lotes hasta que el cliente lo pida. Cada pieza agregada debe responder a un requisito de la sección 0.
3. **Inventario como libro de movimientos.** El stock no se edita a mano: toda entrada o salida es un movimiento con motivo, usuario y referencia, en la misma transacción que actualiza el saldo.
4. **Carga masiva como planilla.** Todo lo que se registra en lote (mermas, ingresos, conteos, precios) se hace en una **grilla tipo Excel**, igual que Shopify y WooCommerce (ver sección 6).
5. **Guardarraíles que no se negocian.** Validación en el servidor, transacciones, permisos por rol, idempotencia de webhooks, auditoría y backups probados.
6. **Propiedad del cliente.** Docker Compose en un VPS a su nombre, todo open source.

## 2. Stack (v0.2)

| Capa | Tecnología | Qué nos ahorra |
|---|---|---|
| Backend | **Django 5** | Login, sesiones, CSRF, usuarios, grupos y permisos, ORM, migraciones y **Django Admin** listos |
| Base de datos | PostgreSQL 16 | Transacciones y restricciones |
| Back-office | **Django Admin** | CRUD de catálogo, usuarios, roles, mapeo de SKU de Shopify y metas, sin pantallas propias |
| Pantallas operativas | Plantillas Django + **HTMX** + **Alpine.js** | Interactividad sin SPA, sin build y sin API duplicada |
| Planillas | **AG Grid Community** (MIT) | Grilla editable con teclado, copiar/pegar desde Excel, validación por celda |
| Importar/exportar | **django-import-export** | Excel/CSV para catálogo, precios y conteos |
| Gráficos | **Chart.js** | Reportes |
| Shopify | Webhooks verificados con HMAC + `ShopifyAPI` para la reconciliación | Cliente oficial |
| Proxy / TLS | Caddy | HTTPS automático |
| Despliegue | Docker Compose | Tres contenedores: `caddy`, `app`, `db` |

### Qué se quitó respecto a v0.1 y por qué

| Antes (v0.1) | Ahora | Motivo |
|---|---|---|
| NestJS + React SPA + paquete de tipos compartidos | Django + HTMX | Una sola app; sin API y frontend duplicados |
| JWT + refresh tokens | Sesiones de Django | Ya incluidas y seguras; es una app interna |
| Pantallas CRUD propias (catálogo, usuarios, config) | Django Admin | Gratis y probado |
| SSE / WebSocket | HTMX con refresco cada 5 s | Suficiente para una tienda; sin infraestructura extra |
| pg-boss (cola de trabajos) | Webhook procesado en la misma petición + comando nocturno por cron | El volumen es bajo; la idempotencia la da una clave única |
| Eventos de dominio entre módulos | Funciones de servicio llamadas dentro de una transacción | Menos indirección |
| Versionado de recetas | La comanda **copia** las líneas de la receta al crearse | Mismo resultado, una tabla menos |
| Tabla `stock_level` + `location` | Columna `stock` en `item`, actualizada en la transacción del movimiento | Una bodega |
| Tabla `receivable` | Saldo = total − pagos (consulta) | Dato derivado |
| `cash_register` | Solo `cash_session` | Una caja |
| Vistas materializadas | Consultas normales | Volumen pequeño |
| Lotes y caducidad | Fuera hasta que se pida | Pregunta abierta |

## 3. Vista general

```
 Navegador (POS, taller, admin)
          │ HTTPS
     ┌────▼────┐
     │  Caddy  │
     └────┬────┘
     ┌────▼──────────────────────────┐        ┌──────────────┐
     │ Django                        │◄───────│ Shopify      │ webhooks (HMAC)
     │  · pantallas HTMX             │───────►│ Admin API    │ reconciliación nocturna
     │  · Django Admin (back-office) │        └──────────────┘
     │  · servicios de dominio       │
     └────┬──────────────────────────┘
     ┌────▼──────┐   cron: pg_dump diario cifrado → almacenamiento externo
     │ Postgres  │   cron: reconciliación Shopify (manage.py)
     └───────────┘
```

## 4. Apps de Django

```
erp/
  catalog/      Item (insumo, arreglo, reventa), RecipeLine, ShopifySku
  inventory/    Movement, StockSheet + StockSheetLine (planillas), servicios move()
  sales/        Sale, SaleLine, Payment, CashSession, SalesGoal
  production/   ProductionOrder, ProductionOrderLine (copia de receta)
  shopify/      ShopifyEvent, vista del webhook, comando de reconciliación
  reports/      vistas de solo lectura
```

Toda regla de negocio vive en **funciones de servicio** (`inventory.services.move`, `sales.services.checkout`, `production.services.finish`…) que validan y escriben dentro de `transaction.atomic()`. Las vistas solo llaman a esas funciones.

## 5. Modelo de datos

### Catálogo
- `Item(sku, name, kind: SUPPLY|PRODUCT|RESALE, unit, decimals, price, cost, stock numeric(12,3), min_stock, photo, active, created_by)`.
  - **Tipos:** *Insumo* (flores, papel, cintas; se compra y se usa en recetas, no se vende suelto), *Arreglo* (se arma con insumos; al venderse genera comanda), *Reventa* (peluches, chocolates; se compra y se vende tal cual).
  - `photo`: `ImageField` en `/media`, redimensionada a 600 px al subirla.
- `RecipeLine(product, supply, qty)`: materiales del arreglo, en la unidad base de cada insumo (ej. 6 tallos, 1.5 m de cinta, 0.25 kg de musgo).
- `ShopifySku(shopify_variant_id, item)`: mapeo editable en el Admin.

### Unidades de medida y presentaciones
- **Unidad base** (`unit`): en qué se cuenta el stock y se escriben las recetas: `unidad`, `tallo`, `rama`, `pliego`, `kg`, `g`, `metro`, `litro`. Es **una sola por item**; todo el stock y todos los costos se guardan en ella.
- **Decimales** (`decimals`): kg, metro y litro admiten fracciones (0.25 kg); tallo y unidad solo enteros. El servidor rechaza cantidades fraccionarias donde no corresponden.
- **Presentación de compra** `Packaging(item, name, factor)`: cómo lo vende el proveedor. "Paquete x25" = 25 tallos; "Saco 5 kg" = 5 kg; "Caja x6" = 6 unidades. Un item puede tener varias.
- **Ingreso:** se elige la presentación y la cantidad; el sistema suma `cantidad × factor` en la unidad base. Si se indica el costo por presentación, el costo por unidad base se recalcula con **promedio ponderado**: `(stock × costo + entra × costo_nuevo) / (stock + entra)`.
- **Venta por peso o medida:** si un producto de reventa está en kg o metro, el POS pide la cantidad (0.25 kg) y cobra `precio × cantidad`.
- **Costo de un arreglo** = Σ (cantidad del material × costo por unidad base). Se muestra con el margen al crear o editar el arreglo.

### Alta y edición de productos (ficha)
Pantalla **Catálogo**:
- **Grilla editable** para cambios masivos de precio, costo y stock mínimo (como el editor masivo de Shopify), guardados en una sola transacción.
- **Ficha de producto** para crear o editar uno: foto (subir o arrastrar), tipo, nombre, SKU automático, y según el tipo:
  - *Arreglo:* precio de venta y lista de materiales (insumo + cantidad con su unidad), con costo y margen en vivo.
  - *Insumo / Reventa:* unidad base, decimales, costo por unidad base, precio de venta (reventa), stock mínimo y presentaciones de compra.
- Administración crea y edita todo; ventas solo crea arreglos nuevos. En la app final, la grilla y la ficha cubren el día a día y Django Admin queda para casos raros.

### Inventario
- `Movement(item, qty firmado, type, reason, sheet?, ref, user, created_at)`.
  - `type`: `PURCHASE_IN | SALE_OUT | SHOPIFY_OUT | PRODUCTION_CONSUME | WASTE | COUNT_ADJUST`.
  - `inventory.services.move()` valida, bloquea la fila del item (`select_for_update`), impide stock negativo y escribe movimiento + saldo juntos.
- `StockSheet(kind: WASTE|PURCHASE|COUNT, status: DRAFT|POSTED, note, created_by, posted_by, posted_at)` y `StockSheetLine(sheet, item, reason?, qty, unit_cost)`.
  - Una planilla se puede guardar como borrador y se **contabiliza** una sola vez: todas sus líneas generan movimientos en una transacción. Si una línea falla, no se registra ninguna.

### Ventas, caja y metas
- `Sale(source: POS|SHOPIFY, status, seller, customer_name, customer_phone, total)`, `SaleLine(sale, item, qty, price)`.
- `Payment(sale, method, amount, reference)`. Estado de la venta derivado: `PAID | PARTIAL | UNPAID | PENDING_PAYMENT`.
- `CashSession(opened_by, opening_float, opened_at, closed_at, counted, expected)`.
- `SalesGoal(seller, month, target)`. El avance se calcula por consulta.

### Producción
- `ProductionOrder(sale_line, product, qty, status: PENDING|IN_PROGRESS|DONE)` + `ProductionOrderLine(order, supply, qty)` copiadas de la receta al crearla.
- Al pasar a `DONE` se descuentan esas líneas. Solo se permite avanzar un estado a la vez (`PENDING → IN_PROGRESS → DONE`).

### Usuarios
- Usuarios y **grupos** de Django: `Administracion`, `Ventas`, `Produccion`, con permisos por modelo y acción.

## 6. Planillas tipo Excel

### Por qué Shopify y WooCommerce usan celdas
- **Se registra en lote, no de a uno.** Al cerrar el día la florista revisa 30 insumos; con un formulario por merma son 30 envíos, con una grilla es una pasada.
- **Teclado primero.** Tab, Enter y flechas para moverse; escribir un número y seguir. Sin abrir modales ni buscar en selects.
- **Copiar y pegar desde Excel.** El proveedor manda su guía en Excel; se pega directo en la columna de cantidades.
- **Ver todo antes de confirmar.** Totales por fila y columna, valor en soles y stock resultante en vivo; las celdas inválidas se marcan antes de guardar.
- **Un solo guardado atómico.** Todo o nada, con un registro de la planilla para revisar después.

### Un solo componente, cuatro usos
| Planilla | Filas | Columnas editables | Resultado |
|---|---|---|---|
| **Mermas** | Insumos y reventa | Una columna por motivo: Marchita, Dañada, Vencida, Error de producción, Otro + nota | Movimientos `WASTE` por motivo |
| **Ingreso de mercadería** | Insumos y reventa | Presentación (Paquete x25, suelto…), cantidad, costo por presentación | Movimientos `PURCHASE_IN` en unidad base y costo promedio |
| **Conteo físico** | Insumos y reventa | Stock contado | Diferencia contra el sistema → `COUNT_ADJUST` |
| **Catálogo** | Todos los productos | Nombre, precio, costo, mínimo de stock | Actualización masiva con auditoría |

### Reglas de la grilla
- Columnas fijas: insumo (congelada a la izquierda), unidad y stock actual. Columnas calculadas: total, stock final y valor S/.
- Validación por celda: números ≥ 0, no más que el stock disponible y decimales solo si la unidad lo permite. Las celdas en error se pintan en rojo y bloquean el guardado.
- Las celdas modificadas se resaltan. Contador "N filas con cambios". Aviso al salir con cambios sin guardar.
- Filtro por texto y "solo con cambios". Fila de totales al pie.
- Confirmación con resumen antes de contabilizar (ej. "Se registrarán 12 mermas por S/ 84.50").

## 7. Flujos críticos

### 7.1 Venta en POS
1. Requiere caja abierta.
2. `checkout()` toma precios de la base, valida stock de reventa y crea venta, líneas y pagos en una transacción.
3. Reventa: movimiento `SALE_OUT`. Arreglo: comanda con copia de la receta.
4. Si queda saldo, se exige cliente; el saldo aparece en Cobranza.

### 7.2 Comanda digital
Tablero Pendiente / En proceso / Lista que se refresca cada 5 s. Al marcar lista se descuentan los insumos copiados en la comanda. El desperdicio durante la producción se registra en la planilla de mermas con motivo "Error de producción".

### 7.3 Shopify → ERP
1. Webhooks `orders/create`, `orders/paid`, `orders/cancelled`, `refunds/create`.
2. Verificar HMAC; rechazar si falla.
3. `ShopifyEvent` con clave única sobre `X-Shopify-Webhook-Id`: un reintento no se procesa dos veces.
4. `orders/create` registra la venta como `PENDING_PAYMENT`; `orders/paid` descuenta stock o crea comandas.
5. SKU sin mapeo o stock insuficiente: evento `NEEDS_ATTENTION` visible en el Admin; el pedido no se pierde.
6. Cron nocturno compara las últimas 48 h con la Admin API para recuperar webhooks perdidos.

### 7.4 Cierre de caja
Esperado = fondo inicial + cobros en efectivo de la sesión. El cajero ingresa lo contado; se guarda la diferencia y se cierra la sesión.

## 8. Reportes
Consultas directas con Chart.js: más vendidos por mes y año, ventas por vendedor contra su meta, cobrado vs. por cobrar, mermas por insumo y motivo (en soles), stock bajo. Proyección simple: promedio de los mismos meses de años anteriores cuando haya histórico.

## 9. Seguridad
- Sesiones de Django, contraseñas con el hasher por defecto (PBKDF2/argon2), CSRF activo.
- Permisos por grupo verificados en cada vista y servicio; la interfaz solo oculta.
- HTTPS, límite de intentos de login (`django-axes`), webhooks con HMAC.
- `.env` fuera del repositorio.
- Auditoría: `LogEntry` del Admin + quién contabilizó cada planilla, cerró caja o anuló venta.
- Backup diario cifrado y prueba de restauración documentada.

## 10. Despliegue
VPS de 2 vCPU y 2–4 GB de RAM con Ubuntu LTS. `docker compose up -d`; las migraciones corren al arrancar. CI con GitHub Actions (tests + build). Entregables: código fuente, README de operación, runbook de backup y restauración, accesos a nombre del cliente.

## 11. Estructura del repositorio
```
ERP-Demo/
  erp/            proyecto Django (apps de la sección 4)
  templates/      pantallas HTMX
  static/         Alpine, AG Grid, Chart.js (versiones fijas)
  infra/          docker-compose.yml, Caddyfile, backup/
  demo/           prototipo sin dependencias
  docs/
```

## 12. Plan por fases
| Fase | Contenido |
|---|---|
| 0 | Levantamiento: catálogo real, recetas, motivos de merma |
| 1 | Modelos, Django Admin, grupos y permisos, carga inicial por Excel |
| 2 | Inventario: servicio de movimientos + **planillas** (ingreso, mermas, conteo) |
| 3 | POS, caja y cierre |
| 4 | Comandas y cobranza |
| 5 | Shopify |
| 6 | Reportes, despliegue, backups y capacitación |

## 13. Preguntas abiertas
1. ¿Control por lote y caducidad de flor fresca?
2. ¿Tarjeta en tienda con terminal físico o Culqi? ¿Link de pago para pedidos por teléfono?
3. ¿Modelo de impresora térmica? ¿Cajón de dinero o lector de códigos?
4. ¿Volumen diario de pedidos y picos en fechas especiales?
5. ¿Moneda e impuestos? (se asume Perú: PEN e IGV)
6. ¿Proveedor de VPS preferido?
7. ¿Las mermas se registran al cierre del día, por turno o cuando ocurren?
