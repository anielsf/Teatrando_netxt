# 🎭 Teatrando

**Teatrando** es una plataforma web para descubrir la oferta teatral y gestionar la experiencia de compra y consulta de entradas. El proyecto está construido con Next.js y React, utiliza Supabase para autenticación y servicios de datos, y está preparado para desplegarse en Vercel.

🌐 **Aplicación publicada:** https://teatrando-netxt.vercel.app  
💻 **Repositorio:** https://github.com/anielsf/Teatrando_netxt

## ✨ Funcionalidades

El proyecto incluye una base para las siguientes áreas de la plataforma:

- **Carteleras y teatros:** organización y consulta de información sobre obras y espacios teatrales.
- **Cuentas y sesiones:** autenticación gestionada con Supabase y páginas privadas para usuarios registrados.
- **Roles y permisos:** control de acceso basado en el rol guardado en `public.profiles`.
- **Entradas y compra:** flujo de consulta y compra de entradas, con generación de códigos QR disponible en el stack del proyecto.
- **Área de administración:** rutas privadas para las tareas administrativas.
- **Suscripciones y participación:** estructura de aplicación para servicios y funcionalidades asociados a usuarios.
- **Tasa de cambio:** integración de la tasa BCV en el flujo de la aplicación.
- **Protección de API:** limitación de solicitudes mediante Upstash Redis cuando sus variables de entorno están configuradas.

> Las funcionalidades disponibles pueden depender de la configuración de Supabase, las variables de entorno y el estado de cada módulo del despliegue.

## 🧰 Tecnologías

| Tecnología | Uso |
|---|---|
| [Next.js 14](https://nextjs.org/) | Framework de aplicación web y rutas |
| [React 18](https://react.dev/) | Interfaz de usuario |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático |
| [Supabase](https://supabase.com/) | Autenticación y servicios de base de datos |
| PostgreSQL (`pg`) | Conexiones directas a PostgreSQL cuando corresponda |
| [Upstash Redis](https://upstash.com/) | Rate limiting de API |
| [Zustand](https://zustand-demo.pmnd.rs/) | Estado compartido del cliente |
| [React Hook Form](https://react-hook-form.com/) y [Zod](https://zod.dev/) | Formularios y validación |
| [QRCode](https://www.npmjs.com/package/qrcode) | Generación de códigos QR |
| [Vercel Analytics](https://vercel.com/analytics) | Analítica del despliegue |

## 📁 Estructura del proyecto

```text
Teatrando_netxt/
├── app/                   # Páginas, layouts y rutas de la aplicación
├── components/            # Componentes reutilizables de interfaz
├── database/migrations/   # Migraciones y cambios del esquema de base de datos
├── hooks/                 # Hooks personalizados de React
├── lib/                   # Clientes, utilidades y lógica compartida
├── store/                 # Estado global del cliente
├── styles/                # Estilos de la aplicación
├── middleware.ts          # Sesión, protección de rutas y rate limiting
├── .env.local.example     # Plantilla de variables de entorno
├── next.config.mjs        # Configuración de Next.js y cabeceras
├── package.json           # Scripts y dependencias
└── tsconfig.json          # Configuración de TypeScript
```

## ⚙️ Requisitos

- Node.js **18.17 o superior** (se recomienda una versión LTS compatible).
- npm.
- Un proyecto de [Supabase](https://supabase.com/) configurado.
- Una base de datos PostgreSQL accesible si se utiliza la conexión directa configurada en el proyecto.
- Una base de Upstash Redis si se desea habilitar el rate limiting externo.

## 🚀 Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/anielsf/Teatrando_netxt.git
cd Teatrando_netxt
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar las variables de entorno

Copia `.env.local.example` como `.env.local`.

En **Windows PowerShell**:

```powershell
Copy-Item .env.local.example .env.local
```

En **macOS/Linux**:

```bash
cp .env.local.example .env.local
```

Abre `.env.local` y completa los valores correspondientes:

| Variable | Propósito |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública/anon de Supabase para operaciones permitidas por las políticas de la base de datos |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada para operaciones privilegiadas del servidor, si el módulo la requiere |
| `POSTGRES_URL` | Cadena de conexión PostgreSQL usada por las conexiones directas del servidor |
| `UPSTASH_REDIS_REST_URL` | URL REST de Upstash Redis; necesaria para activar el rate limiting externo |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de Upstash Redis |
| `NEXT_PUBLIC_APP_URL` | URL base de la aplicación; en local, `http://localhost:3000` |

Los valores de Supabase se obtienen en el panel del proyecto. La cadena `POSTGRES_URL` se obtiene en la sección de conexión de la base de datos. Las variables de Upstash se obtienen desde la base Redis correspondiente.

**Seguridad:** no publiques el contenido real de `.env.local`. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL` ni tokens privados en el navegador, en capturas de pantalla o en el repositorio. El archivo `.gitignore` está configurado para excluir los archivos de entorno locales.

### 4. Preparar la base de datos

1. Abre el proyecto correspondiente en Supabase.
2. Revisa los archivos de `database/migrations/`.
3. Ejecuta las migraciones necesarias en el orden previsto por el proyecto mediante el mecanismo de migraciones o el editor SQL de Supabase.
4. Verifica que existan las tablas, relaciones y políticas de seguridad que necesita cada módulo.

No ejecutes migraciones en una base de datos de producción sin revisar primero sus efectos y contar con una copia de seguridad.

### 5. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## 🧪 Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia Next.js en modo desarrollo |
| `npm run build` | Genera la compilación de producción |
| `npm run start` | Ejecuta la aplicación compilada |
| `npm run lint` | Ejecuta el comando de lint de Next.js definido por el proyecto |
| `npm run type-check` | Comprueba los tipos de TypeScript sin generar archivos (`tsc --noEmit`) |

Antes de publicar cambios, conviene ejecutar:

```bash
npm run type-check
npm run build
```

## 🔐 Autenticación y control de acceso

La sesión se gestiona mediante Supabase SSR. El archivo `middleware.ts` actualiza la sesión y consulta el rol del usuario desde `public.profiles`.

En la configuración actual del middleware:

- `/cuenta` y `/checkout` requieren sesión y un rol permitido.
- `/admin` está restringida a los roles definidos para esa ruta.
- Las solicitudes a `/api/` pueden limitarse mediante Upstash Redis, cuando se han configurado `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.

Configura y prueba también las políticas **Row Level Security (RLS)** de Supabase. La protección en el middleware no sustituye las reglas de acceso de la propia base de datos.

## ☁️ Despliegue en Vercel

1. Importa el repositorio desde [Vercel](https://vercel.com/).
2. Configura las variables de entorno necesarias en **Project Settings → Environment Variables**.
3. Establece `NEXT_PUBLIC_APP_URL` con el dominio real del despliegue, por ejemplo `https://teatrando-netxt.vercel.app`.
4. Comprueba que las credenciales, las tablas y las políticas de Supabase correspondan al entorno de producción.
5. Despliega y revisa los registros de compilación y ejecución.

Si el despliegue falla durante la compilación o ciertas páginas no muestran datos, verifica primero las variables de entorno y el esquema de Supabase.

## 🛠️ Desarrollo y contribuciones

1. Crea una rama para tu cambio.
2. Realiza modificaciones pequeñas y descriptivas.
3. Ejecuta `npm run type-check` y `npm run build`.
4. Prueba el flujo afectado con las variables y los servicios requeridos.
5. Abre un Pull Request con un resumen del cambio y los pasos para comprobarlo.


Desarrollado para acercar el público al teatro y facilitar la gestión de su experiencia teatral.

## Base de datos

La documentación de la base de datos describe las tablas principales del esquema `public`, sus columnas, tipos de datos y las ocho relaciones conocidas entre usuarios, carteleras, teatros, entradas, interacciones y suscripciones.

- [Consultar el inventario de tablas y relaciones](store/database.md)
- El diagrama muestra las relaciones proporcionadas; las consultas SQL del documento permiten contrastarlas con el esquema activo de Supabase.
- Las credenciales y claves privadas deben configurarse mediante variables de entorno y nunca almacenarse en el repositorio.

## Licencia y derechos de autor

**Copyright © 2026 Angel farias y asociados. Todos los derechos reservados.**

Para consultar las condiciones completas, revisa el archivo [`LICENSE`](./LICENSE).
