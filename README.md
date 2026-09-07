# CREDIT-ON

Sistema integral de gestión crediticia, cobranzas, caja y control patrimonial para una operatoria de campo en Santiago del Estero.

Este proyecto combina:

- Frontend administrativo en Electron + React + Tailwind
- PWA móvil offline-first para cobradores en calle
- Base de datos centralizada en Supabase
- Motor de reglas de negocio para pagos, calendario y cierre de caja
- Paneles de control para inventario, patrimonios, operaciones y rendición

## Características principales

- Alta de operaciones y asignación por cobrador
- Cálculo de cronogramas con días hábiles (lunes a sábado)
- Registro de cobros con lógica en cascada y validaciones
- Cierre de caja y arqueo por cobrador
- Dashboard patrimonial y evaluación de cartera
- Gestión de stock y recuperación de bienes
- Hoja de ruta imprimible para contingencias
- PWA para cobranza móvil con sincronización y almacenamiento local

## Stack tecnológico

- Node.js + Vite
- React 18
- Electron
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth + RPC)
- IndexedDB para la PWA offline

## Requisitos previos

- Node.js 18, 20 o 22
- npm
- Acceso a un proyecto Supabase configurado

## Instalación

1. Clonar el repositorio:

```bash
git clone <url-del-repositorio>
cd credit-on
```

2. Instalar dependencias:

```bash
npm install
```

3. Crear variables de entorno para Supabase:

Crear un archivo `.env.local` en la raíz del proyecto con algo como:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_clave_publica
```

> Importante: no uses la `service_role` ni claves privadas en variables `VITE_*`.

## Ejecución

### Modo desktop (Electron)

```bash
npm run dev
```

Esto levanta la aplicación de escritorio.

### Modo web

```bash
npm run dev:web
```

Esto sirve la app en el navegador. Por defecto se expone en:

```text
http://localhost:3000
```

Si estás en la misma red, puedes abrir la app desde un celular usando la IP local del PC.

## Pruebas

### Motor de pagos

```bash
npm run test:payments
```

Valida reglas de cobro, pagos parciales, adelantos, vencimientos, mora y idempotencia.

### Motor de calendario

```bash
npm run test:calendar
```

Valida la lógica de cronogramas con exclusión de domingos y feriados.

## Estructura principal del proyecto

```text
credit-on/
├── src/
│   ├── core/                  # Lógica central del calendario y reglas operativas
│   ├── main/                  # Proceso principal de Electron
│   ├── preload/               # APIs expuestas a la UI mediante contextBridge
│   ├── pwa/                   # PWA móvil del cobrador
│   │   ├── components/        # UI móvil y formularios de cobro
│   │   ├── db/                # IndexedDB local
│   │   ├── sync/              # Sincronización con Supabase
│   │   └── public/            # Manifest y assets PWA
│   ├── renderer/              # Frontend administrativo en React
│   │   └── src/
│   │       ├── components/    # Controles de sesión y acceso
│   │       ├── lib/           # Cliente Supabase y helpers
│   │       ├── views/         # Pantallas del sistema
│   │       └── App.tsx        # Navegación principal
│   ├── services/              # Servicios transaccionales y tests
│   ├── types/                 # Modelos TypeScript
│   └── index.ts               # Punto de entrada general
├── supabase/
│   └── migrations/            # SQL de la base de datos
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron.vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── README.md
└── ...
```

## Supabase y base de datos

Se espera que la base de datos esté creada y migrada con los scripts SQL de la carpeta `supabase/migrations`.

El flujo recomendado es:

1. Ejecutar las migraciones en orden
2. Configurar Auth con usuarios y roles
3. Asignar metadatos de usuario según perfil

Ejemplo de roles esperados:

```json
{ "credit_on_role": "admin" }
```

```json
{ "credit_on_role": "cobrador", "id_cobrador": 1 }
```

El sistema usa estas credenciales para distinguir acceso administrativo y acceso de cobrador.

## Funcionalidades clave del sistema

### Administrador / dueño

- Cierre de caja y arqueo diario
- Dashboard patrimonial
- Alta de operaciones
- Control de stock y recuperación
- Visualización de folios, rendición y saldos

### Cobrador en campo

- Tiene acceso a la PWA
- Trabaja con hoja de ruta descargada
- Registra cobros aunque no haya conexión
- Los movimientos quedan en cola para sincronizar cuando haya señal

## Consideraciones de seguridad

- No subas claves secretas a Git
- Mantén la `service_role` fuera del cliente frontend
- Usá `VITE_*` solo para variables públicas
- Mantené los permisos de Supabase con RLS configurado

## Flujo de desarrollo recomendado

```bash
npm install
npm run dev
```

Luego, si necesitás validar reglas de negocio:

```bash
npm run test:payments
npm run test:calendar
```

## Licencia

Este proyecto se entrega bajo la licencia del equipo de desarrollo del sistema. Revisa el contrato o la política interna de uso antes de desplegarlo en producción.

## Contacto

Sistema CREDIT-ON — Santiago del Estero

---

Si querés, también puedo dejarte una segunda versión del README más orientada a:

- presentación para clientes,
- documentación técnica interna,
- o despliegue/producción con pasos de Supabase y build final.
