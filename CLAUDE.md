# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos frecuentes

```bash
pnpm dev              # servidor local en http://localhost:4321
pnpm typecheck        # astro check + tsc --noEmit
pnpm lint             # eslint . (flat config)
pnpm test             # vitest run (un pase)
pnpm test:watch       # vitest en modo watch
pnpm test:coverage    # vitest con cobertura v8 → coverage/
pnpm build            # astro build (output en dist/)
pnpm format           # prettier --write .
```

> **Windows + pnpm:** `pnpm build` falla con EPERM al crear symlinks en `.vercel/output/`.  
> Es un problema del entorno local de Windows, no del código. El build funciona en Vercel CI (Linux).

## Stack y restricciones clave

- **Node 24 + pnpm 11.5.1** — `create-astro` es incompatible con Node 24; el scaffolding fue manual.
- **ESLint 10 flat config** — la configuración está en `eslint.config.js`, no en `.eslintrc`.
- **TypeScript 6 strict** — extiende `astro/tsconfigs/strict`. Path alias `@/` → `src/`.
- **Tailwind CSS 4** — vía plugin Vite (`@tailwindcss/vite`), sin `tailwind.config.*`. Los tokens (colores, fuentes, sombras) se definen en `@theme {}` dentro de `src/styles/global.css`.
- **Astro output `static`** — las rutas API declaran `export const prerender = false` individualmente.

## Arquitectura

```
src/
├── layouts/Base.astro          # HTML shell: <head>, Nav, footer, WhatsApp flotante, IntersectionObserver reveal
├── pages/
│   ├── index.astro             # Landing: importa Base + 7 secciones
│   └── api/appointments.ts    # POST /api/appointments — prerender false
├── components/
│   ├── nav/Nav.astro           # Navbar fija, drawer mobile, scroll-spy
│   └── sections/               # Un componente por sección de la landing
│       ├── Hero.astro
│       ├── Badges.astro        # Trust strip tipográfico (01–04 en teal)
│       ├── Services.astro      # Grid 3→2→1 cols
│       ├── About.astro
│       ├── Steps.astro
│       ├── Testimonials.astro
│       ├── CTA.astro
│       └── AppointmentForm.astro  # Formulario → fetch POST /api/appointments
├── domain/
│   └── scheduling/
│       ├── appointment.ts      # Zod schema, tipos, toInsertPayload, catálogo SERVICES
│       └── appointment.test.ts # 15 tests (únicos tests del proyecto)
├── infra/
│   ├── repositories/appointmentsRepo.ts  # Cliente Supabase server-only (SERVICE_ROLE_KEY)
│   └── email/emailService.ts             # Resend — emails paciente + staff
└── styles/global.css           # @theme tokens + utilidades + animaciones
```

### Flujo de la solicitud de cita

`AppointmentForm.astro` (fetch) → `POST /api/appointments.ts` → Zod valida → `appointmentsRepo.createAppointment()` → Supabase → `emailService.sendAppointmentEmails()` (best-effort, no bloquea respuesta).

### Convenciones de dominio

- **`SERVICES`** en `appointment.ts` es la fuente única del catálogo de servicios. Si cambia, actualizar también `Services.astro`.
- El repo Supabase usa **SERVICE_ROLE_KEY** (server-only). Nunca importar desde islas/cliente.
- Cobertura de tests scoped a `src/domain/**` y `src/infra/**` (no UI).

## Variables de entorno

Crear `.env.local` (excluido por `.gitignore`). Ver `.env.example` para la plantilla completa.

| Variable                    | Requerida | Descripción                                        |
| --------------------------- | --------- | -------------------------------------------------- |
| `SUPABASE_URL`              | Sí        | URL del proyecto Supabase                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí        | Key server-only (bypasea RLS)                      |
| `RESEND_API_KEY`            | No        | Sin ella los emails se omiten silenciosamente      |
| `RESEND_FROM_EMAIL`         | No        | Remitente; `onboarding@resend.dev` funciona en dev |
| `RESEND_NOTIFY_EMAIL`       | No        | Buzón del staff que recibe notificaciones          |

## Seguridad (vercel.json)

CSP estricta + HSTS + COOP + CORP + Permissions-Policy configurados en `vercel.json`.  
Si se añaden nuevos orígenes externos (fuentes, CDN, APIs), actualizar la cabecera `Content-Security-Policy`.

## Fase actual y roadmap

- **Fase 0** ✅ Landing HTML estática
- **Fase 1** ✅ Migración a Astro + tooling (ESLint, Vitest, CI, Tailwind, CSP)
- **Fase 2** ✅ Agenda pública (Supabase + Zod + API + Resend)
- **Fase 3** ⏭️ Panel staff — Supabase Auth + MFA + RBAC (admin / recepción / odontólogo) + audit log
- **Fase 4** Hardening final — Playwright E2E + Sentry + Lighthouse CI ≥ 95
