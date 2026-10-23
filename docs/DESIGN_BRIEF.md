# Brief de diseño: ERP Floreria

Inventario completo de lo que tiene la demo actual (`demo/`), para rediseñar la interfaz. Todo el texto de la UI es en español (Peru, moneda S/).

## 1. Producto y usuarios

ERP a medida para una floreria con una tienda fisica, una bodega y tienda online en Shopify. Reemplaza comandas en papel y centraliza ventas, stock, produccion y cobranza.

| Rol | Quien es | Ve | Puede |
|---|---|---|---|
| Administracion | Dueño/a o encargado | Todo | Todo: ingresos de mercaderia, metas, reportes, Shopify |
| Ventas | Cajeros/vendedores | POS, Produccion (solo lectura), Inventario, Cobranza | Vender, abrir/cerrar caja, cobrar saldos, crear arreglos |
| Produccion | Floristas | Produccion, Inventario, Mermas | Mover comandas, registrar mermas |

Uso principal: computadora de mostrador (POS) y tablet o pantalla en el taller (Produccion). Debe funcionar en celular.

Prioridad de UX: **rapidez en caja** (pocos clics, teclado) y **flujo que no permita errores** (no cobrar dos veces, no vender sin stock, no dejar saldo sin cliente).

## 2. Estructura general (shell)

- **Barra lateral fija** (232 px):
  - Logo + nombre "Floreria · ERP".
  - Navegacion con icono + etiqueta; item activo resaltado. Las pestañas visibles dependen del rol.
  - Badge con numero de comandas pendientes en "Produccion".
  - Abajo: tarjeta de **estado de caja** (abierta/cerrada, punto verde/rojo, "Esperado S/ X") y **selector de usuario** con avatar (inicial). En la demo el selector reemplaza al login.
- **Encabezado de pagina:** titulo, subtitulo de ayuda y botones de accion a la derecha (cambian por pantalla).
- **Notificaciones (toasts)** abajo a la derecha: exito (verde), error (rojo), neutro. Se cierran solas.
- **Modales** centrados con titulo, cuerpo, pie con "Cancelar" y accion principal. Cierran con Esc o clic fuera.
- **Responsive:** < 860 px la barra lateral pasa a barra superior horizontal con iconos; < 1100 px el ticket del POS baja debajo del catalogo.
- **Modo oscuro** automatico segun el sistema.
- Actualizacion automatica cada 5 s (badge de comandas, estado de caja, tablero de produccion).

## 3. Pantallas

### 3.1 Punto de venta (POS)
Acciones de cabecera: **Nuevo arreglo**, **Abrir caja** / **Cerrar caja**.

Columna izquierda, catalogo:
- Buscador con icono y pista de atajo `/`.
- Filtro segmentado: Todo · Arreglos · Reventa.
- Grilla de tarjetas de producto: ilustracion/emoji sobre fondo de color, nombre, subtitulo ("Arreglo · se produce" o "Reventa · stock N"), precio. Badge con la cantidad si ya esta en el ticket. Tarjeta atenuada si no queda stock.
- Estado vacio: "Sin resultados".

Columna derecha, **ticket** (fijo al hacer scroll):
- Lineas: nombre, precio unitario, nota "genera comanda" si es arreglo, stepper − cantidad +, subtotal. Boton "Vaciar".
- Estado vacio: "Ticket vacio · Toca un producto o busca con /".
- Aviso rojo si la caja esta cerrada, con boton "Abrir caja".
- Total grande.
- Metodo de pago (segmentado): Efectivo · Tarjeta · Yape/Plin · Transferencia · Culqi.
- "Cobrar ahora" (prellenado con el total) y, solo en efectivo, "Recibe" (opcional).
- Cliente (nombre o telefono); se vuelve obligatorio si queda saldo.
- Avisos en vivo: "Quedara un saldo de S/ X en cobranza" (amarillo), "Vuelto: S/ X" (verde), "Lo recibido es menor al monto" (rojo).
- Boton principal grande "Cobrar S/ X  F9" (deshabilitado sin items o con caja cerrada).
- Tras cobrar: toast "Venta #N registrada · N comanda(s) enviadas a produccion · Vuelto S/ X", ticket vacio y foco de vuelta al buscador.

Atajos: `/` buscar · `Enter` agrega el primer resultado · `F9` cobrar · `Esc` cerrar modal.

### 3.2 Produccion (comandas digitales)
- Tablero kanban de 3 columnas: **Pendientes** (rosa) · **En proceso** (ambar) · **Listas** (verde), con contador.
- Tarjeta de comanda: emoji + producto, cantidad (xN), "Comanda #N · Venta #N · Cliente · fecha/hora", chips de insumos necesarios (ej. "Rosa roja x12"), boton de avance: "Empezar" → "Marcar lista".
- Comandas nuevas parpadean un instante.
- Ventas ve el tablero en solo lectura (aviso amarillo, sin botones).
- Al marcar lista: toast "Insumos descontados del inventario". Si falta stock: error "Stock insuficiente de X (hay N, se necesitan M)".
- Estado vacio por columna: "Sin comandas".

### 3.3 Inventario
- 4 KPIs: Items con stock · Stock bajo (en rojo, con nombres) · Valor a costo · Movimientos registrados.
- Tabla **Stock actual**: item (nombre, SKU, tipo, minimo), stock + unidad, barra de nivel (verde/rosa/rojo segun minimo).
- Tabla **Libro de movimientos** (ultimos 60, con scroll): fecha, item + referencia + usuario, tipo como etiqueta de color (Ingreso, Venta, Shopify, Produccion, Merma), cantidad +verde / −rojo.
- Admin: boton "Ingreso de mercaderia" → modal con item, cantidad, referencia (proveedor/guia).

### 3.4 Mermas
- Formulario: insumo o producto (con stock actual), cantidad, motivo segmentado (Marchita · Dañada · Vencida · Error de produccion · Otro), boton "Registrar merma".
- Grafico de barras horizontales **por motivo**.
- Historial: item, fecha, usuario, motivo (etiqueta roja), cantidad negativa.

### 3.5 Cobranza
- 3 KPIs: Por cobrar (y numero de ventas) · Ventas registradas · Monto vendido.
- Tabla **Cuentas por cobrar**: venta, fecha, cliente, total, saldo, boton "Registrar pago" → modal con saldo pendiente, monto (prellenado) y metodo.
- Tabla **Ventas recientes**: #, origen (POS / SHOPIFY), cliente, detalle de productos, vendedor, total, pagado, estado (Pagada verde · Parcial ambar · Sin pagar rojo · Esperando pago gris).
- Estado vacio: "Todo cobrado".

### 3.6 Reportes (solo admin)
- 4 KPIs: Vendido (desglose POS/Shopify) · Cobrado · Por cobrar · Stock bajo.
- **Metas de venta del mes:** por vendedor, vendido / meta, barra de progreso, etiqueta % o "Alcanzada". Boton "Fijar meta" → modal con vendedor y monto.
- **Productos mas vendidos:** barras horizontales con unidades e ingreso.
- **Ventas por vendedor:** barras con numero de ventas y total.
- **Stock bajo:** lista con stock y minimo.

### 3.7 Shopify (solo admin, simulador)
- Tres pasos en tarjetas:
  1. **Crear pedido** (orders/create): producto + cantidad. "Se registra, no toca stock". Incluye opcion "SKU sin mapeo" para probar errores.
  2. **Marcar pagado** (orders/paid): muestra el pedido; "Descuenta stock o crea la comanda".
  3. **Reenviar ultimo webhook:** prueba que el duplicado se ignora.
- Tabla **Eventos recibidos:** fecha, id de webhook, topic, estado (OK / Revisar), detalle.

### 3.8 Modales
| Modal | Campos | Validacion |
|---|---|---|
| Nuevo arreglo | Nombre, precio, filas de receta (insumo + cantidad, agregar/quitar) | Calcula **costo de insumos y margen %** en vivo; sin insumos repetidos |
| Abrir caja | Fondo inicial (200 por defecto) | — |
| Cierre de caja | Muestra fondo y efectivo cobrado; campo "efectivo contado" | Diferencia en vivo: "Cuadra exacto" o sobrante/faltante |
| Registrar pago | Monto, metodo | No mayor al saldo |
| Ingreso de mercaderia | Item, cantidad, referencia | Cantidad > 0 |
| Meta de venta | Vendedor, monto | Monto > 0 |

## 4. Reglas de negocio que la UI debe reflejar

- Los arreglos tienen **receta fija**; su stock no se lleva, se descuentan los insumos al terminar la comanda.
- La reventa (peluches, chocolates) descuenta stock al venderse.
- Shopify descuenta stock **solo cuando el pedido se paga**.
- No se vende sin caja abierta. Venta con saldo exige cliente.
- El precio lo define el sistema, no se edita en caja.
- Sin facturacion fiscal: solo ticket no fiscal (aun sin pantalla de impresion).
- Una sola bodega.

## 5. Datos de ejemplo

- Usuarios: Ana (Administracion), Luis (Ventas), Marta (Ventas), Carlos (Produccion).
- Insumos: Rosa roja, Rosa blanca, Girasol, Lirio (tallo), Follaje (rama), Papel kraft (pliego), Liston (metro), Caja de regalo.
- Reventa: Peluche oso S/ 25, Caja de chocolates S/ 18.
- Arreglos: Ramo 12 rosas rojas S/ 85, Ramo girasoles x6 S/ 70, Caja de rosas blancas S/ 120, Arreglo de lirios S/ 95.
- Metas: Luis S/ 3,000 y Marta S/ 2,500 en el mes.

## 6. Estilo actual (punto de partida, se puede cambiar)

- Tipografia: Inter / Segoe UI / system-ui, 14 px base.
- Colores: fondo crema `#f5f3ef`, superficie blanca, marca verde bosque `#1f5c46`, acento rosa `#d2486f`, exito `#2f7d55`, alerta `#a86a12`, error `#c23b32`. Version oscura equivalente.
- Radios 10–18 px, sombras suaves, etiquetas en pildora, iconos de trazo (estilo Lucide), emojis como ilustracion de producto.

## 7. Faltantes y oportunidades para el diseño

- Pantalla de **login** y perfil.
- **Ticket imprimible** de 80 mm y vista de comanda impresa.
- **Gestion de catalogo:** editar/archivar productos, precios, fotos reales, recetas versionadas.
- **Clientes:** busqueda, historial, datos de entrega.
- **Pedidos con entrega** (fecha, hora, direccion, dedicatoria) y vista de agenda para fechas pico (San Valentin, Dia de la Madre).
- **Graficos por periodo** (dia/mes/año) y proyecciones.
- **Historial de cierres de caja**.
- Alertas de stock bajo en el dashboard y vista de inicio por rol.
- Pantalla de configuracion (usuarios, roles, mapeo de SKUs de Shopify).
- Estados de carga (skeletons) y confirmaciones antes de acciones irreversibles.
