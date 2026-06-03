import { Resend } from 'resend'
import { TIME_WINDOW_LABELS, type AppointmentRow } from '@/domain/scheduling/appointment'

/**
 * Servicio de email transaccional vía Resend.
 *
 * Envíos al crear una solicitud:
 *  1. Acuse de recibo al paciente.
 *  2. Notificación al staff con los datos para llamar y confirmar.
 *
 * Si Resend no está configurado, los envíos se omiten silenciosamente y se
 * registra un warning. Esto permite que la creación de citas siga funcionando
 * en local sin bloquear el flujo.
 */

let cachedClient: Resend | null = null

function getClient(): Resend | null {
  if (cachedClient) return cachedClient
  const key = import.meta.env.RESEND_API_KEY
  if (!key) return null
  cachedClient = new Resend(key)
  return cachedClient
}

export function isEmailConfigured(): boolean {
  return Boolean(import.meta.env.RESEND_API_KEY && import.meta.env.RESEND_FROM_EMAIL)
}

interface SendResult {
  patientEmailSent: boolean
  staffEmailSent: boolean
}

export async function sendAppointmentEmails(appt: AppointmentRow): Promise<SendResult> {
  const client = getClient()
  const from = import.meta.env.RESEND_FROM_EMAIL
  const staffTo = import.meta.env.RESEND_NOTIFY_EMAIL

  if (!client || !from) {
    console.warn(
      '[email] Resend no configurado (faltan RESEND_API_KEY o RESEND_FROM_EMAIL). Emails omitidos.',
    )
    return { patientEmailSent: false, staffEmailSent: false }
  }

  const results = await Promise.allSettled([
    client.emails.send({
      from,
      to: appt.patient_email,
      subject: 'Recibimos tu solicitud de cita — MARFIL Clínica Dental',
      html: renderPatientEmail(appt),
    }),
    staffTo
      ? client.emails.send({
          from,
          to: staffTo,
          replyTo: appt.patient_email,
          subject: `Nueva solicitud de cita — ${appt.patient_name}`,
          html: renderStaffEmail(appt),
        })
      : Promise.resolve(null),
  ])

  const patientResult = results[0]
  const staffResult = results[1]

  if (patientResult.status === 'rejected') {
    console.error('[email] Falló envío al paciente:', patientResult.reason)
  }
  if (staffResult.status === 'rejected') {
    console.error('[email] Falló notificación al staff:', staffResult.reason)
  }

  return {
    patientEmailSent: patientResult.status === 'fulfilled',
    staffEmailSent: staffResult.status === 'fulfilled' && staffResult.value !== null,
  }
}

function renderPatientEmail(appt: AppointmentRow): string {
  const dateLabel = formatDateEs(appt.preferred_date)
  const windowLabel = TIME_WINDOW_LABELS[appt.time_window]
  return `
<!doctype html>
<html lang="es">
  <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #eef5f7; padding: 24px; color: #0e3a47;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="font-size: 22px; margin: 0 0 16px;">Hola ${escapeHtml(appt.patient_name)}, ✦</h1>
        <p style="margin: 0 0 16px; line-height: 1.55;">
          Recibimos tu solicitud de cita en <strong>MARFIL Clínica Dental</strong>.
          Nuestro equipo te contactará pronto para confirmar el día y la hora.
        </p>
        <div style="background: #f6fafb; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
          <p style="margin: 0 0 6px;"><strong>Servicio:</strong> ${escapeHtml(appt.service)}</p>
          <p style="margin: 0 0 6px;"><strong>Fecha preferida:</strong> ${escapeHtml(dateLabel)}</p>
          <p style="margin: 0;"><strong>Franja:</strong> ${escapeHtml(windowLabel)}</p>
        </div>
        <p style="margin: 0 0 16px;">
          Si necesitas algo urgente, escríbenos por WhatsApp al
          <a href="https://wa.me/573147132470" style="color: #0e938d;">+57 314 713 2470</a>.
        </p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #456973;">
          Carrera 11 # 14-110, Chipre — Manizales, Caldas<br/>
          Lun–Vie 8am–7pm · Sáb 8am–1pm
        </p>
      </td></tr>
    </table>
  </body>
</html>`.trim()
}

function renderStaffEmail(appt: AppointmentRow): string {
  const dateLabel = formatDateEs(appt.preferred_date)
  const windowLabel = TIME_WINDOW_LABELS[appt.time_window]
  return `
<!doctype html>
<html lang="es">
  <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; color: #0e3a47;">
    <h2 style="margin: 0 0 12px;">Nueva solicitud de cita</h2>
    <table cellpadding="6" cellspacing="0" style="font-size: 14px; border-collapse: collapse;">
      <tr><td><strong>Paciente:</strong></td><td>${escapeHtml(appt.patient_name)}</td></tr>
      <tr><td><strong>Teléfono:</strong></td><td><a href="tel:${escapeAttr(appt.patient_phone)}">${escapeHtml(appt.patient_phone)}</a></td></tr>
      <tr><td><strong>Email:</strong></td><td><a href="mailto:${escapeAttr(appt.patient_email)}">${escapeHtml(appt.patient_email)}</a></td></tr>
      <tr><td><strong>Servicio:</strong></td><td>${escapeHtml(appt.service)}</td></tr>
      <tr><td><strong>Fecha preferida:</strong></td><td>${escapeHtml(dateLabel)}</td></tr>
      <tr><td><strong>Franja:</strong></td><td>${escapeHtml(windowLabel)}</td></tr>
      ${appt.notes ? `<tr><td valign="top"><strong>Notas:</strong></td><td>${escapeHtml(appt.notes)}</td></tr>` : ''}
    </table>
    <p style="margin-top: 20px; font-size: 12px; color: #456973;">
      ID: ${escapeHtml(appt.id)} — Creada: ${escapeHtml(appt.created_at)}
    </p>
  </body>
</html>`.trim()
}

function formatDateEs(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return yyyyMmDd
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, '')
}
