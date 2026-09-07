# CREDIT-ON — Sistema Integral de Gestión Crediticia y Cobranzas

Solución de software híbrida para la empresa **CREDIT-ON** (Santiago del Estero):
- **Backoffice Desktop (.exe)** para el Dueño / Administrador (Electron + React + Tailwind CSS).
- **Terminal Web Móvil PWA** Offline-First para el Cobrador en Calle (Ariel y equipo).
- **Base de Datos Cloud** centralizada en Supabase (PostgreSQL) con sincronización bidireccional y $0/mes en infraestructura.

---

## 🚀 Cómo Ejecutar la Aplicación

### 1. Requisitos Previos
Tener instalado [Node.js](https://nodejs.org/) (versión 18, 20 o 22).

### 2. Instalación de Dependencias
Abre una terminal (PowerShell, CMD o Git Bash) en la carpeta del proyecto:
```bash
cd c:\Users\Esteban\Desktop\hernan\credit-on
npm install
```

---

## Conexión con Supabase

La aplicación ya usa Supabase para el alta de operaciones, los cierres de caja y la sincronización offline de cobros. Para enlazar un proyecto real:

1. En el SQL Editor de Supabase, ejecutá las migraciones en orden: `001_schema_maestro.sql`, `002_schema_transaccional.sql`, `003_triggers_funciones_vistas.sql`, `004_rls_seguridad_seed.sql` y `005_seguridad_api.sql`.
2. Copiá `.env.example` como `.env.local` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` desde **Project Settings → API**. La `service_role` nunca debe ir en este archivo ni en el frontend.
3. Creá los usuarios en **Authentication → Users** y definí su `raw_app_meta_data` con uno de estos perfiles:

   ```json
   { "credit_on_role": "admin" }
   ```

   ```json
   { "credit_on_role": "cobrador", "id_cobrador": 1 }
   ```

   El `id_cobrador` debe coincidir con `cobradores.id_cobrador`. Después de cambiar esos metadatos, el usuario debe cerrar sesión y volver a entrar para renovar su JWT.
4. Reiniciá `npm run dev` o `npm run dev:web` e iniciá sesión desde el botón de la barra superior.

La ruta móvil descarga `vw_hoja_de_ruta` para el `VITE_COBRADOR_ID` configurado y guarda una copia en IndexedDB para trabajar sin señal. Si la conexión o la sesión no están disponibles, conserva la cola pendiente y no confirma falsamente los cobros.

## 🖥️ Modos de Ejecución

### Opción A: Aplicación de Escritorio Nativa (Electron Desktop)
Abre la ventana nativa de escritorio con todas las funciones de administración, Cierre de Caja y Arqueo:
```bash
npm run dev
```

### Opción B: Modo Web / Navegador (PC y Celular)
Levanta un servidor local rápido sin necesidad de empaquetar Electron. Te permite abrir la aplicación en tu navegador (`Chrome`, `Edge`) y acceder desde tu teléfono móvil conectado a la misma red Wi-Fi:
```bash
npm run dev:web
```
- **Desde la PC:** Abre [http://localhost:3000](http://localhost:3000)
- **Desde el Celular del Cobrador:** Abre la IP local que te muestra la terminal (ej. `http://192.168.1.XX:3000`)

---

## 🧪 Ejecución de Pruebas Automatizadas

Para validar las reglas de negocio, la cascada de cobros y el calendario (sin necesidad de levantar la interfaz):

1. **Pruebas del Motor de Cobros en Cascada (32 tests):**
   ```bash
   npm run test:payments
   ```
   Valida pagos parciales, acumulados al día siguiente, adelantos, cancelaciones totales, detección de mora crítica e idempotencia.

2. **Pruebas del Motor de Calendario Lunes a Sábado (33 tests):**
   ```bash
   npm run test:calendar
   ```
   Valida la exclusión automática de domingos y feriados nacionales.

---

## 📂 Estructura del Proyecto

```text
credit-on/
├── src/
│   ├── core/                  # Motor de calendario (Lunes a Sábado, feriados)
│   ├── services/              # Servicio transaccional de pagos en cascada e idempotencia
│   ├── types/                 # Modelos de datos TypeScript (operaciones, cuotas, cobros)
│   ├── main/                  # Proceso principal de Electron (.exe)
│   ├── preload/               # ContextBridge seguro de Electron
│   ├── renderer/              # Frontend React + Tailwind CSS (Vistas del Administrador)
│   │   └── src/views/
│   │       ├── CierreCajaArqueo.tsx     # PANTALLA PRIORITARIA de Arqueo y Rendición
│   │       ├── DashboardPatrimonio.tsx  # Métricas de Valuación en tiempo real
│   │       ├── AltaOperacion.tsx        # Alta de préstamos y ventas
│   │       ├── GestionStock.tsx         # Control de depósito y retiro por mora
│   │       └── HojaDeRutaImprimible.tsx # Plantilla física A4 para contingencias
│   └── pwa/                   # PWA Móvil Offline-First para el Cobrador en Calle
│       ├── db/pwa-db.ts       # Base de datos local IndexedDB
│       ├── sync/sync-engine.ts# Motor de sincronización background con Supabase
│       └── components/        # Terminal móvil con Keypad táctil
├── supabase/
│   └── migrations/            # Scripts SQL para correr en Supabase SQL Editor
└── package.json
```
