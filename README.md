# MARFIL · Clínica Dental

Sitio web y plataforma de gestión de citas para **MARFIL Clínica Dental**, Manizales, Colombia.  
Landing pública con agenda online → panel staff → sistema de citas propio.

---

## Stack

| Capa          | Tecnología                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| Framework     | [Astro 6](https://astro.build) — output `static`, rutas API con `prerender = false` |
| CSS           | [Tailwind CSS 4](https://tailwindcss.com) vía `@tailwindcss/vite`                   |
| Deploy        | [Vercel](https://vercel.com) con `@astrojs/vercel`                                  |
| Base de datos | [Supabase](https://supabase.com) — PostgreSQL + RLS + RBAC                          |
| Email         | [Resend](https://resend.com) — emails transaccionales                               |
| Validación    | [Zod 4](https://zod.dev)                                                            |
| Tests         | [Vitest 4](https://vitest.dev) + cobertura v8                                       |
| Linter        | ESLint 10 flat config + `typescript-eslint` strict + `eslint-plugin-astro`          |
| Formato       | Prettier + `prettier-plugin-astro` + `prettier-plugin-tailwindcss`                  |
| Hooks         | Husky 9 + commitlint (conventional commits) + lint-staged                           |
| CI            | GitHub Actions — typecheck → lint → test → build                                    |
| Runtime       | Node 24 · pnpm 11.5.1 · TypeScript 6 strict                                         |

---

## Requisitos previos

- **Node.js 24+** — `create-astro` es incompatible con Node 24; este proyecto fue scaffoldeado manualmente.
- **pnpm 11.5.1** — se usa como único gestor de paquetes (`pnpm-workspace.yaml` presente).

---

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd marfil-dental

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores reales (ver sección Variables de entorno)

# 4. Arrancar el servidor de desarrollo
pnpm dev
# → http://localhost:4321
```

---

## Scripts disponibles

```bash
pnpm dev            # Servidor de desarrollo con HMR
pnpm build          # Build de producción → dist/
pnpm preview        # Previsualizar el build local

pnpm typecheck      # astro check + tsc --noEmit
pnpm lint           # ESLint sobre todo el proyecto
pnpm format         # Prettier sobre todo el proyecto

pnpm test           # Vitest — un pase completo
pnpm test:watch     # Vitest en modo watch
pnpm test:coverage  # Vitest con reporte de cobertura → coverage/
```

> **Nota Windows:** `pnpm build` puede fallar con `EPERM` al crear symlinks en `.vercel/output/`.
> Es una limitación del entorno local; el build funciona correctamente en Vercel CI (Linux).

---

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores. **Nunca commitear `.env.local`.**

```env
# Supabase — requerido para persistir citas
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only, nunca exponer al cliente

# Resend — opcional; si falta, los emails se omiten silenciosamente
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="MARFIL Clínica Dental <citas@tudominio.co>"
RESEND_NOTIFY_EMAIL=staff@tudominio.co
```

En producción, configurar estas variables en **Vercel → Project Settings → Environment Variables**.

---

## Estructura del proyecto

```
marfil-dental/
├── .github/
│   └── workflows/ci.yml            # Pipeline CI: typecheck → lint → test → build
├── supabase/
│   └── migrations/
│       └── 0001_appointments.sql   # Tabla appointments + RLS + enums + trigger
├── src/
│   ├── layouts/
│   │   └── Base.astro              # HTML shell: head, Nav, footer, WhatsApp flotante
│   ├── pages/
│   │   ├── index.astro             # Landing — compone todas las secciones
│   │   └── api/
│   │       └── appointments.ts    # POST /api/appointments (prerender = false)
│   ├── components/
│   │   ├── nav/Nav.astro           # Navbar fija con drawer mobile
│   │   └── sections/               # Una sección por componente
│   │       ├── Hero.astro
│   │       ├── Badges.astro        # Strip de diferenciadores (diseño tipográfico 01–04)
│   │       ├── Services.astro
│   │       ├── About.astro
│   │       ├── Steps.astro
│   │       ├── Testimonials.astro
│   │       ├── CTA.astro
│   │       └── AppointmentForm.astro
│   ├── domain/
│   │   └── scheduling/
│   │       ├── appointment.ts      # Zod schema · tipos · catálogo SERVICES · toInsertPayload
│   │       └── appointment.test.ts # Tests unitarios del dominio
│   ├── infra/
│   │   ├── repositories/
│   │   │   └── appointmentsRepo.ts # Cliente Supabase (server-only)
│   │   └── email/
│   │       └── emailService.ts     # Envíos Resend — acuse al paciente + notif. staff
│   ├── styles/
│   │   └── global.css              # @theme tokens · utilidades · animaciones reveal
│   └── env.d.ts                    # Tipos de import.meta.env
├── .env.example                    # Plantilla de variables de entorno
├── astro.config.mjs                # Config Astro: output static + Tailwind + Vercel adapter
├── eslint.config.js                # ESLint 10 flat config
├── vercel.json                     # Headers de seguridad: CSP · HSTS · COOP · CORP
├── vitest.config.ts                # Cobertura scoped a domain/ e infra/
└── tsconfig.json                   # Extiende astro/tsconfigs/strict · path alias @/→src/
```

---

## Arquitectura y decisiones clave

### Flujo de una solicitud de cita

```
AppointmentForm.astro   →   POST /api/appointments
        ↓                          ↓
  fetch + JSON            Zod valida payload
                                   ↓
                        appointmentsRepo.createAppointment()
                                   ↓
                            Supabase INSERT
                                   ↓
                     emailService.sendAppointmentEmails()
                       (best-effort, no bloquea respuesta)
```

### Seguridad de la base de datos

La tabla `appointments` usa **Row Level Security** con tres políticas:

| Rol                                  | Permisos                               |
| ------------------------------------ | -------------------------------------- |
| `anon` (público)                     | Solo `INSERT` con `status = 'pending'` |
| `authenticated` con `role = 'staff'` | `SELECT`, `UPDATE`, `DELETE`           |

El backend usa `SERVICE_ROLE_KEY` (bypasea RLS) **únicamente** desde el endpoint server-side. Nunca se expone al cliente.

### Catálogo de servicios

`SERVICES` en `src/domain/scheduling/appointment.ts` es la **fuente única de verdad**. Si se modifica el catálogo, actualizar también `Services.astro`.

### Tokens de diseño

Los colores, fuentes y sombras del sistema de diseño están en `src/styles/global.css` dentro del bloque `@theme {}` de Tailwind 4. No existe `tailwind.config.*`.

---

## Base de datos (Supabase)

Para aplicar la migración inicial en un proyecto Supabase nuevo:

1. Ir a **SQL Editor** en el dashboard de Supabase
2. Pegar y ejecutar el contenido de `supabase/migrations/0001_appointments.sql`

Para asignar el rol de staff a un usuario:

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}', '"staff"'
)
WHERE email = 'admin@marfildental.co';
```

---

## CI/CD

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) corre en cada push/PR a `main` y `master`:

```
typecheck → lint → test → build
```

El deploy a Vercel es automático desde la rama `master` por integración nativa de Vercel con GitHub.

---

## Roadmap

| Fase   | Estado | Descripción                                                          |
| ------ | ------ | -------------------------------------------------------------------- |
| Fase 0 | ✅     | Landing HTML estática hardened                                       |
| Fase 1 | ✅     | Migración a Astro + ESLint + Vitest + CI + Tailwind 4 + CSP          |
| Fase 2 | ✅     | Agenda pública: Supabase schema + RLS + `/api/appointments` + Resend |
| Fase 3 | ⏭️     | Panel staff: Supabase Auth + MFA + RBAC + audit log                  |
| Fase 4 | ⬜     | Hardening: Playwright E2E + Sentry + Lighthouse CI ≥ 95              |

---

## Información de contacto

|             |                                                  |
| ----------- | ------------------------------------------------ |
| Clínica     | MARFIL Clínica Dental                            |
| Dirección   | Carrera 11 # 14-110, Chipre — Manizales, Caldas  |
| Teléfono    | +57 314 713 2470                                 |
| WhatsApp    | [wa.me/573147132470](https://wa.me/573147132470) |
| Horario     | Lun–Vie 8am–7pm · Sáb 8am–1pm                    |
| Responsable | Juan Sebastian Osorio Gomez — CC 1.053.866.540   |

---

## Licencia

Código privado. Todos los derechos reservados © 2026 MARFIL Clínica Dental.
