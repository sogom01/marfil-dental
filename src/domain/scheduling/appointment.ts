import { z } from 'zod'

/**
 * Catálogo cerrado de servicios. Debe coincidir con los títulos mostrados en
 * `src/components/sections/Services.astro`. Si cambia el catálogo, actualizar
 * ambos lugares (y considerar una migración para datos históricos).
 */
export const SERVICES = [
  'Limpieza & Prevención',
  'Ortodoncia',
  'Implantes Dentales',
  'Estética Dental',
  'Blanqueamiento',
  'Odontopediatría',
] as const

export type Service = (typeof SERVICES)[number]

export const TIME_WINDOWS = ['morning', 'afternoon'] as const
export type TimeWindow = (typeof TIME_WINDOWS)[number]

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  morning: 'Mañana (8am – 12pm)',
  afternoon: 'Tarde (2pm – 7pm)',
}

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/**
 * Acepta teléfonos colombianos en formatos comunes:
 *   3147132470, +57 314 713 2470, 314-713-2470, etc.
 * Reglas: 7–15 dígitos, opcionalmente con prefijo +57 y separadores
 * ` `, `-`, `(`, `)`.
 */
const PHONE_REGEX = /^\+?[0-9()\s-]{7,20}$/

/**
 * Schema de la solicitud entrante (formulario público).
 * Sanitiza espacios sobrantes y normaliza el teléfono.
 */
export const appointmentRequestSchema = z.object({
  patientName: z.string().trim().min(2, 'El nombre es muy corto').max(80, 'El nombre es muy largo'),
  patientPhone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Teléfono inválido')
    .transform((raw) => normalizePhone(raw)),
  patientEmail: z.email('Email inválido').trim().toLowerCase().max(120, 'Email demasiado largo'),
  service: z.enum(SERVICES, { message: 'Servicio no válido' }),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)')
    .refine(isTodayOrFuture, 'La fecha debe ser hoy o posterior'),
  timeWindow: z.enum(TIME_WINDOWS, { message: 'Franja horaria inválida' }),
  notes: z
    .string()
    .trim()
    .max(500, 'Las notas no pueden superar 500 caracteres')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  consentGiven: z.literal(true, {
    message: 'Debes aceptar la política de privacidad',
  }),
})

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>

/**
 * Representación persistida (columnas snake_case de Supabase).
 */
export interface AppointmentRow {
  id: string
  created_at: string
  updated_at: string
  patient_name: string
  patient_phone: string
  patient_email: string
  service: Service
  preferred_date: string
  time_window: TimeWindow
  notes: string | null
  consent_given: boolean
  source_ip: string | null
  user_agent: string | null
  status: AppointmentStatus
  staff_notes: string | null
  confirmed_at: string | null
  confirmed_by: string | null
}

/**
 * Convierte la solicitud validada (camelCase) al payload de insert en Supabase.
 */
export function toInsertPayload(
  req: AppointmentRequest,
  meta: { sourceIp?: string | null; userAgent?: string | null },
): Omit<
  AppointmentRow,
  'id' | 'created_at' | 'updated_at' | 'status' | 'staff_notes' | 'confirmed_at' | 'confirmed_by'
> {
  return {
    patient_name: req.patientName,
    patient_phone: req.patientPhone,
    patient_email: req.patientEmail,
    service: req.service,
    preferred_date: req.preferredDate,
    time_window: req.timeWindow,
    notes: req.notes ?? null,
    consent_given: req.consentGiven,
    source_ip: meta.sourceIp ?? null,
    user_agent: meta.userAgent ?? null,
  }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `+${digits.slice(1).replace(/\D/g, '')}`
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`
  return digits
}

function isTodayOrFuture(yyyyMmDd: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const candidate = new Date(`${yyyyMmDd}T00:00:00`)
  return !Number.isNaN(candidate.getTime()) && candidate.getTime() >= today.getTime()
}
