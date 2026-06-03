-- ============================================================
-- MARFIL Clínica Dental — Fase 2: Agenda pública
-- Migración 0001: tabla appointments con RLS estricta
-- ============================================================
--
-- Modelo de reserva: solicitud → staff confirma.
-- El paciente envía una solicitud anónima desde el sitio público; staff
-- la confirma o cancela manualmente desde el panel (Fase 3).
--
-- Aplicar en Supabase con:
--   supabase db push
-- o pegando el contenido en el SQL Editor del dashboard.

-- ------------------------------------------------------------
-- Enum de estados
-- ------------------------------------------------------------
create type appointment_status as enum (
  'pending',     -- solicitud nueva, sin contactar
  'confirmed',   -- staff confirmó por teléfono/whatsapp
  'cancelled',   -- paciente o staff cancelaron
  'completed'    -- cita realizada
);

create type appointment_time_window as enum ('morning', 'afternoon');

-- ------------------------------------------------------------
-- Tabla principal
-- ------------------------------------------------------------
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Datos del paciente (entregados por el formulario público)
  patient_name    text        not null check (char_length(patient_name) between 2 and 80),
  patient_phone   text        not null check (patient_phone ~ '^\+?[0-9 ]{7,20}$'),
  patient_email   text        not null check (patient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Solicitud de cita
  service         text        not null,
  preferred_date  date        not null check (preferred_date >= current_date),
  time_window     appointment_time_window not null,
  notes           text        check (notes is null or char_length(notes) <= 500),

  -- Consent y trazabilidad
  consent_given   boolean     not null default false check (consent_given = true),
  source_ip       inet,
  user_agent      text        check (user_agent is null or char_length(user_agent) <= 500),

  -- Estado interno
  status          appointment_status not null default 'pending',
  staff_notes     text        check (staff_notes is null or char_length(staff_notes) <= 1000),
  confirmed_at    timestamptz,
  confirmed_by    uuid        references auth.users (id) on delete set null
);

create index appointments_status_created_idx
  on appointments (status, created_at desc);

create index appointments_preferred_date_idx
  on appointments (preferred_date);

-- ------------------------------------------------------------
-- Trigger: updated_at automático
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_set_updated_at
before update on appointments
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table appointments enable row level security;

-- Por defecto nadie puede leer ni escribir. Las políticas siguientes
-- otorgan permisos explícitos.

-- INSERT público: cualquier visitante (rol `anon`) puede crear solicitudes,
-- pero solo en estado 'pending' y sin tocar campos internos.
create policy "anon can create pending appointment requests"
on appointments
for insert
to anon
with check (
  status = 'pending'
  and confirmed_at is null
  and confirmed_by is null
  and staff_notes is null
);

-- SELECT/UPDATE/DELETE: solo usuarios autenticados con role = 'staff'
-- en su JWT (custom claim configurado vía Supabase Auth Hooks o en
-- raw_user_meta_data).
create policy "staff can read all appointments"
on appointments
for select
to authenticated
using ((auth.jwt() ->> 'role') = 'staff');

create policy "staff can update appointments"
on appointments
for update
to authenticated
using ((auth.jwt() ->> 'role') = 'staff')
with check ((auth.jwt() ->> 'role') = 'staff');

create policy "staff can delete appointments"
on appointments
for delete
to authenticated
using ((auth.jwt() ->> 'role') = 'staff');

-- ------------------------------------------------------------
-- Notas operativas
-- ------------------------------------------------------------
-- 1. El backend del sitio público debe usar la SERVICE_ROLE_KEY solo
--    desde el endpoint /api/appointments (server-side). Nunca exponer
--    esa key al cliente.
-- 2. Para que un usuario sea reconocido como staff, asignar la claim
--    en Supabase: update auth.users set raw_user_meta_data = jsonb_set(
--      coalesce(raw_user_meta_data, '{}'::jsonb), '{role}', '"staff"'
--    ) where email = 'admin@marfildental.co';
-- 3. La lista cerrada de `service` se valida en el dominio (zod) antes
--    de llegar a la BD. Si se cambia el catálogo, actualizar
--    src/domain/scheduling/appointment.ts.
