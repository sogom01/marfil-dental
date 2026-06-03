import type { APIRoute } from 'astro'
import { ZodError } from 'zod'
import { appointmentRequestSchema, toInsertPayload } from '@/domain/scheduling/appointment'
import { createAppointment, isSupabaseConfigured } from '@/infra/repositories/appointmentsRepo'
import { sendAppointmentEmails } from '@/infra/email/emailService'

export const prerender = false

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!isSupabaseConfigured()) {
    return json(503, {
      ok: false,
      error: 'El servicio de agendamiento no está disponible. Por favor escríbenos por WhatsApp.',
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { ok: false, error: 'Cuerpo de la petición inválido.' })
  }

  const parsed = appointmentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return json(400, {
      ok: false,
      error: 'Datos inválidos.',
      issues: flattenZodIssues(parsed.error),
    })
  }

  const sourceIp = safeClientAddress(clientAddress)
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  try {
    const inserted = await createAppointment(toInsertPayload(parsed.data, { sourceIp, userAgent }))

    // Email es best-effort: si falla, la cita ya quedó persistida y el staff
    // la verá en el panel. No bloqueamos la respuesta al paciente.
    void sendAppointmentEmails(inserted).catch((err: unknown) => {
      console.error('[appointments] sendAppointmentEmails inesperado:', err)
    })

    return json(201, {
      ok: true,
      appointmentId: inserted.id,
    })
  } catch (err) {
    console.error('[appointments] Error creando cita:', err)
    return json(500, {
      ok: false,
      error: 'No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.',
    })
  }
}

function flattenZodIssues(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

function safeClientAddress(addr: string | undefined): string | null {
  if (!addr) return null
  // Astro entrega "ip:port" o solo "ip" según el adapter. Strip puerto si viene.
  const trimmed = addr.split(',')[0]?.trim() ?? ''
  if (!trimmed) return null
  return trimmed.replace(/:\d+$/, '')
}
