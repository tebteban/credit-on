# Informe: Sistema de cobros de préstamos y productos en cuotas
### Análisis de los archivos Excel actuales y propuesta de flujo de información

---

## 1. Contexto del negocio (según lo que muestran los archivos)

Los archivos corresponden a una financiera/comercializadora que opera bajo el nombre **"CREDIT-ON – Equipamiento Comercial y Hogar / Préstamos"** (Santiago del Estero), con dos líneas de negocio que comparten el mismo mecanismo de cobro:

1. **Préstamos en efectivo**: se presta una suma de dinero a un cliente, que la devuelve en cuotas diarias durante una cantidad fija de días (planes típicos: 26, 35 días, con un interés del 30%–40%).
2. **Venta de productos en cuotas**: la empresa compra un producto (electrodoméstico, mueble, celular, etc.) y se lo vende a un cliente, quien lo paga en cuotas diarias durante un plan de días fijo (planes típicos: 42, 84, 135, 175 o 220 cuotas/días).

Los roles que aparecen en los datos son:

- **Cliente**: recibe el préstamo o el producto.
- **Vendedor**: origina la operación (capta al cliente); gana una comisión (columna `VEND.%`).
- **Cobrador**: recorre los domicilios todos los días cobrando la cuota (ej.: Ariel, César, Oriana, Antonela, Alvaro, Luis, y "sub-cobradores" como Emanuel o Walter que reportan a Oriana).
- **Administración/dueño**: consolida capital, compras y rendimiento de cada cobrador (todo indica que "Ariel" cumple este rol, dado que la planilla de rendimiento general lleva su nombre).

---

## 2. Qué es cada archivo, para qué sirve y qué contiene

### 2.1 `LISTA_DE_PRECIO` — El "tarifario" / plantillas de documentos

Es el archivo **origen de las condiciones comerciales**. No registra operaciones concretas, sino las reglas con las que se arma cualquier operación nueva. Tiene 5 hojas:

| Hoja | Contenido | Función |
|---|---|---|
| `Hoja1` / `Hoja6` | Catálogo de productos (aire acondicionado, freezers, heladeras, TVs, celulares, muebles, etc.) con su **costo/monto** y una **matriz de cuotas** por plan (42, 84, 135, 175, 220 días), más una tabla de acumulados por semana (7, 14, 23, 30, 37 semanas) | Calcular cuánto debe pagar el cliente por día y por semana según qué producto eligió y a cuántas cuotas lo financió |
| `Hoja2` | Plantilla **"NOTA DE VENTA"** (Apellido y nombre, DNI, barrio, fecha, N° de OP) | Formulario que se completa a mano/imprime al dar de alta una operación nueva con un cliente |
| `Hoja3` | Plantilla de **"RECIBÍ"** (recibo de entrega de dinero) | Comprobante que se le entrega al cliente o al vendedor al recibir/entregar efectivo |
| `Hoja4` | Tabla de **planes de préstamo en efectivo**: ej. "26 días × 30%", "35 días × 40%", con el cálculo de cuota diaria de ejemplo ($100.000 a 26 días = cuota de $5.000; a 35 días = cuota de $4.000) | Define el interés y la cuota diaria de los préstamos en efectivo |

> **En síntesis**: esta planilla funciona como una "calculadora" de condiciones. Cuando se abre una operación nueva, alguien mira acá el precio del producto o el monto del préstamo, elige el plan de días y de ahí sale el importe de cuota diaria que después se carga a mano en la Base de Datos.

---

### 2.2 `BASE_DE_DATOS_OPERACIONES_A` — El núcleo transaccional del sistema

Es el archivo más importante: es la base de datos real de todas las operaciones (activas e históricas) y su cobranza diaria. Tiene 4 hojas:

**a) Hoja `BASE DATOS`** — Alta de cada operación
Un renglón = una operación (préstamo o venta de producto). Columnas: `N° OP`, `FECHA`, `CLIENTE`, tipo (`PRODUCTOS`), detalle del producto, `CUOTAS` (plan en días), `IMPORTE` (cuota diaria), `TOTAL` (monto total a devolver), `ESTADO` (vacío, "CANC dd/mm/aa", "RETIRADO", "ABOGADO"...), `COBRADOR`, `VENDEDOR`, `RECIBO`, `VEND.%` (comisión del vendedor), `CALIFICACION`, `DOMICILIO`, `DNI`, `TELEFONO`, `TELEFONO FIJO`, `GAN.` (ganancia).

**b) Hoja `COBROS UNIFICADO`** — Registro diario de cobranza (el "diario de caja" de la calle)
Un renglón = un intento/registro de cobro de un cliente en un día puntual. Columnas: `FECHA`, N° de operación (vincula con `BASE DATOS`), `PAGA` (cuotas pagadas ese día, puede ser fraccionario), `CLIENTE`, `IMPORTE` (valor de la cuota), `TOTAL` (monto efectivamente cobrado ese día), `COBRADOR`, `ESTADO` (p.ej. "CANCELADO").

Esta hoja crece todos los días: por cada cliente activo se agrega una fila por cada jornada de cobro (haya pagado o no), lo que arma el historial cuota a cuota.

**c) Hoja `CONTROL COBROS`** — Tablero de control automático (con fórmulas)
Cruza `BASE DATOS` con `COBROS UNIFICADO` para calcular, operación por operación:
- `INICIO` y `PLAN` (traídos de Base de Datos).
- `FINALIZA` = `INICIO + PLAN + PLAN/6` (la fecha estimada de fin del crédito, sumando 1 día de descanso cada 6 días de cobro, porque no se cobra los domingos).
- `PAGADAS` = `SUMIF` sobre `COBROS UNIFICADO` (total de cuotas pagadas a la fecha).
- Días transcurridos (`DAYS360`), días exigibles según el calendario de cobro (descontando 1 de cada 7 días) y **`ATRASO`** = días exigibles − cuotas pagadas → indicador clave de mora por cliente.
- `COBRADOR`, `VENDEDOR`, `DOMICILIO`, `DNI`, teléfonos (traídos de Base de Datos).

Este tablero es, en la práctica, el reporte gerencial: de un vistazo muestra qué clientes están al día y cuáles están atrasados.

**d) Hoja `Hoja1`**: vacía / auxiliar, sin uso relevante detectado.

---

### 2.3 `BASE_DE_DATOS_1_A` — ⚠️ Archivo dañado

Este archivo **no pudo abrirse**: ni Excel/openpyxl ni LibreOffice logran leerlo (el ZIP interno está corrupto). Es un archivo de "Autoguardado", así que probablemente Excel se cerró de forma anómala mientras se guardaba. Por el nombre, parecería ser otra versión o una copia complementaria de la Base de Datos de operaciones.

**Recomendación**: buscar si existe una copia anterior no corrupta (OneDrive/versiones anteriores de Windows, o carpeta de AutoRecuperación de Excel `%AppData%\Microsoft\Excel`), antes de descartarlo.

---

### 2.4 `PLANILLA_DE_COBRO_EFECTIVO_1` y `PLANILLA_DE_COBRO_PRODUCTO_A` — Las hojas de ruta diarias

Son la **planilla que se le entrega al cobrador cada día** para salir a la calle (una para la ruta de efectivo y otra para la ruta de productos). Son un extracto simplificado y filtrado de `BASE DATOS`:

Columnas: `OP`, `CLIENTE`, `CUOTAS` (plan), `IMPORTE` (cuota), `COBRADOR` asignado, `DOMICILIO`, `SEMANAL` (día de la semana en que corresponde pasar, cuando el cobro no es diario sino semanal), y una columna vacía **`COBRADO`** para que el cobrador anote a mano lo efectivamente cobrado ese día.

Es decir: **no son una base de datos**, son un "picking list" de trabajo de campo que se imprime o se exporta desde la Base de Datos, y cuyo resultado (`COBRADO`) es lo que después alguien transcribe a mano en `COBROS UNIFICADO`.

---

### 2.5 `ARIEL_PORCENTAJE` — Control de rendimiento de cobradores y caja

Archivo de gestión/control, con 6 hojas:

| Hoja | Contenido |
|---|---|
| `ariel por.`, `ANTONELA`, `ALVARO`, `ORIANA` | Una hoja por cobrador (o grupo de cobradores a su cargo). Para cada día: `EXIG. DIARIO` (lo que ese cobrador debía cobrar ese día), `COBRADO` (lo que efectivamente cobró), `PORCENTAJE` (cobrado / exigible) y `DIFERENCIA` (faltante). Todo separado en dos bloques: **EFECTIVO** y **PRODUCTO** |
| `Hoja1` | Registro de **"CAPITALIZACIÓN"**: ingresos de capital de terceros que financian los préstamos/compras (ej. "RECIBÍ JUANQUI $900.000", "RECIBÍ HERNAN $300.000") |
| `Hoja2` | Registro de **"COMPRAS DE PRODUCTOS"**: historial de compra de mercadería (fecha, producto, costo neto, estado de pago) |

Esta planilla responde dos preguntas que `BASE_DE_DATOS_OPERACIONES` no responde: **¿cada cobrador está cumpliendo su objetivo diario?** y **¿de dónde sale y a dónde va la plata (capital y compras)?**

---

## 3. Resumen: qué es cada planilla en una frase

| Archivo | Rol en el sistema |
|---|---|
| `LISTA_DE_PRECIO` | Tarifario / reglas de negocio + plantillas de documentos |
| `BASE_DE_DATOS_OPERACIONES_A` | Base de datos maestra: alta de operaciones + historial de cobros + tablero de mora |
| `BASE_DE_DATOS_1_A` | (Dañado — función exacta a confirmar) |
| `PLANILLA_DE_COBRO_EFECTIVO_1` | Hoja de ruta diaria del cobrador — préstamos en efectivo |
| `PLANILLA_DE_COBRO_PRODUCTO_A` | Hoja de ruta diaria del cobrador — productos en cuotas |
| `ARIEL_PORCENTAJE` | Control de rendimiento por cobrador + caja/capital + compras |

---

## 4. Flujo de información actual (cómo se relacionan entre sí)

```
┌──────────────────────────┐
│     LISTA_DE_PRECIO       │   Tarifario de productos y planes de préstamo
│  (catálogo + plantillas)  │   Define: precio, plan de cuotas, interés
└─────────────┬─────────────┘
              │  se consulta para cotizar
              ▼
┌──────────────────────────────────────────┐
│   BASE_DE_DATOS_OPERACIONES_A             │
│   Hoja "BASE DATOS"                       │
│   → Alta de la operación nueva            │
│   (cliente, producto/monto, plan, cuota,  │
│    vendedor, cobrador asignado)           │
└─────────────┬──────────────────────────────┘
              │  se filtra/exporta a diario
              ▼
┌──────────────────────────────────────────┐
│  PLANILLA_DE_COBRO_EFECTIVO               │
│  PLANILLA_DE_COBRO_PRODUCTO               │
│  → Hoja de ruta impresa del cobrador      │
│  (a quién visitar hoy, cuánto cobrar)     │
└─────────────┬──────────────────────────────┘
              │  el cobrador sale a la calle,
              │  cobra y anota "COBRADO" a mano
              ▼
┌──────────────────────────────────────────┐
│   BASE_DE_DATOS_OPERACIONES_A             │
│   Hoja "COBROS UNIFICADO"                 │
│   → Carga manual de lo cobrado ese día,   │
│     por cliente (una fila por día)        │
└─────────────┬──────────────────────────────┘
              │  se recalcula automáticamente (fórmulas)
              ▼
┌──────────────────────────────────────────┐
│   BASE_DE_DATOS_OPERACIONES_A             │
│   Hoja "CONTROL COBROS"                   │
│   → Cuotas pagadas acumuladas, fecha de   │
│     finalización estimada, días de ATRASO,│
│     estado del crédito                    │
└─────────────┬──────────────────────────────┘
              │  se compara lo exigible vs. lo cobrado
              │  por cada cobrador
              ▼
┌──────────────────────────────────────────┐
│   ARIEL_PORCENTAJE                        │
│   → % de cumplimiento diario por cobrador │
│   → Registro de capital aportado          │
│     (Hoja1) y compras de mercadería       │
│     (Hoja2)                               │
└──────────────────────────────────────────┘
```

### Puntos clave del flujo

1. **Un solo origen de verdad partido en dos**: `BASE DATOS` (qué se prestó/vendió) y `COBROS UNIFICADO` (qué se cobró) viven en el mismo archivo pero se cargan en momentos distintos y por personas distintas — el vendedor/administración carga el alta, el cobrador (o quien transcribe su planilla) carga el cobro diario.
2. **El eslabón débil es manual**: entre "lo que el cobrador cobró en la calle" (anotado a mano en `PLANILLA_DE_COBRO_*`) y "lo que queda registrado en el sistema" (`COBROS UNIFICADO`) hay una transcripción manual todos los días, para cada cliente activo. Es el paso con más riesgo de error, olvido o demora.
3. **El tablero de mora (`CONTROL COBROS`) depende 100% de que la transcripción anterior esté al día** — si un día no se carga `COBROS UNIFICADO`, el cálculo de `ATRASO` de todos los clientes se distorsiona.
4. **La performance por cobrador (`ARIEL_PORCENTAJE`) es un cálculo paralelo y manual** de lo mismo que ya está en `CONTROL COBROS` / `COBROS UNIFICADO`, agrupado por cobrador y por día — hoy se arma aparte, cobrador por cobrador, en vez de salir automáticamente de la base.
5. **El tarifario (`LISTA_DE_PRECIO`) no está conectado por fórmula a la Base de Datos**: los importes de cuota se copian a mano al dar de alta una operación, lo que abre la puerta a errores de tipeo entre el precio de lista y lo que efectivamente se carga.

---

## 5. Entidades y relaciones (modelo de datos implícito)

Aunque hoy vive todo en Excel, el sistema ya tiene, en la práctica, un modelo de datos relacional:

- **Producto** (catálogo) `1 —— N` **Operación**
- **Plan de cuotas** (42/84/135/175/220 días, o 26/35 días para efectivo) `1 —— N` **Operación**
- **Cliente** `1 —— N` **Operación** (un cliente puede tener varias operaciones activas: el ejemplo de "RODRIGO EMANUEL ROLDAN" con 3 operaciones distintas el mismo día)
- **Vendedor** `1 —— N` **Operación**
- **Cobrador** `1 —— N` **Operación** (y también `1 —— N` con **Cobro diario**, porque puede cambiar el cobrador asignado a mitad de crédito)
- **Operación** `1 —— N` **Cobro diario** (una fila en `COBROS UNIFICADO` por cada jornada)
- **Cobrador** `1 —— N` **Rendimiento diario** (una fila en `ARIEL_PORCENTAJE` por cobrador y por día)
- **Capitalización** (aporte de capital) — entidad aparte, no vinculada a una operación puntual sino al pool de caja general
- **Compra de producto** — entidad aparte, antecede a la creación de la Operación de tipo "PRODUCTOS"

Este modelo es exactamente el que necesitaría una base de datos (tablas: `clientes`, `productos`, `planes`, `operaciones`, `cobros`, `cobradores`, `vendedores`, `capitalizaciones`, `compras`) si en algún momento se migra el sistema a una aplicación a medida.

---

## 6. Observaciones y riesgos detectados en los archivos actuales

- **Archivo corrupto** (`BASE_DE_DATOS_1_A`): pérdida de información hasta no recuperarlo.
- **Nombres de cliente con variaciones** (ej. "ELIANA LUISINA NAVARRO" vs "ELIANA LUISINA  NAVARRO" con doble espacio) que pueden duplicar registros o romper búsquedas.
- **Fórmulas con errores** (`#DIV/0!` en `ARIEL_PORCENTAJE`) cuando no hay `EXIGIBLE` cargado todavía — no rompen el archivo pero ensucian la lectura visual.
- **Datos sensibles de clientes** (DNI, teléfono, domicilio) mezclados en varias planillas sin control de acceso — algo a tener en cuenta si se digitaliza el sistema.
- **Cálculo de mora dependiente de una fecha "ancla" fija** (`$B$1` en `CONTROL COBROS`) que hay que actualizar a mano cada vez que se recalcula el atraso.
- **Doble carga de información equivalente** entre `COBROS UNIFICADO`/`CONTROL COBROS` y `ARIEL_PORCENTAJE` (rendimiento por cobrador), con riesgo de que ambos números no coincidan.

---

## 7. Qué necesitaría el sistema nuevo (a partir de este análisis)

Para que el sistema que te pidieron cubra lo que hoy hacen estos 6 archivos, como mínimo debería resolver:

1. **Alta de clientes y operaciones** (equivalente a `BASE DATOS` + `LISTA_DE_PRECIO`, pero con el tarifario conectado por fórmula, no copiado a mano).
2. **Generación automática de la hoja de ruta diaria por cobrador** (equivalente a `PLANILLA_DE_COBRO_*`), filtrando quién corresponde visitar ese día.
3. **Carga de cobros desde el campo** (idealmente desde el celular del cobrador, no transcripción manual) que reemplace `COBROS UNIFICADO`.
4. **Cálculo automático de mora/estado de cada operación** (equivalente a `CONTROL COBROS`), sin depender de actualizar una celda de fecha a mano.
5. **Panel de rendimiento por cobrador** (equivalente a `ARIEL_PORCENTAJE`), calculado directamente de los cobros cargados, no en una planilla aparte.
6. **Registro de caja/capital y de compras de mercadería**, para saber en todo momento cuánta plata hay disponible para financiar operaciones nuevas.

---

*Nota: no pude analizar `BASE_DE_DATOS_1_A__Autoguardado_.xlsx` porque el archivo está dañado (el ZIP interno no abre ni en Excel ni en LibreOffice). Si conseguís una versión no corrupta, decime y lo reviso para completar este informe.*
