import { describe, expect, it } from 'vitest'
import { appointmentRequestSchema, toInsertPayload, SERVICES } from './appointment'

const validBase = {
  patientName: 'Ana Sofía Mejía',
  patientPhone: '+57 314 713 2470',
  patientEmail: 'ana.mejia@example.com',
  service: SERVICES[0],
  preferredDate: futureDate(7),
  timeWindow: 'morning' as const,
  notes: 'Sensibilidad al frío',
  consentGiven: true as const,
}

describe('appointmentRequestSchema', () => {
  it('acepta un payload válido y normaliza el teléfono', () => {
    const parsed = appointmentRequestSchema.parse(validBase)
    expect(parsed.patientPhone).toBe('+573147132470')
    expect(parsed.patientEmail).toBe('ana.mejia@example.com')
    expect(parsed.notes).toBe('Sensibilidad al frío')
  })

  it('agrega prefijo +57 a teléfono colombiano de 10 dígitos sin código', () => {
    const parsed = appointmentRequestSchema.parse({ ...validBase, patientPhone: '3147132470' })
    expect(parsed.patientPhone).toBe('+573147132470')
  })

  it('rechaza teléfono con letras', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, patientPhone: 'no-es-tel' })
    expect(res.success).toBe(false)
  })

  it('rechaza email malformado', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, patientEmail: 'no-arroba' })
    expect(res.success).toBe(false)
  })

  it('rechaza fecha en el pasado', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, preferredDate: '2020-01-01' })
    expect(res.success).toBe(false)
  })

  it('acepta la fecha de hoy', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, preferredDate: futureDate(0) })
    expect(res.success).toBe(true)
  })

  it('rechaza servicio fuera del catálogo', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, service: 'Cirugía Cardíaca' })
    expect(res.success).toBe(false)
  })

  it('rechaza timeWindow inválido', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, timeWindow: 'midnight' })
    expect(res.success).toBe(false)
  })

  it('rechaza si consentGiven no es true', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, consentGiven: false })
    expect(res.success).toBe(false)
  })

  it('rechaza nombre demasiado corto', () => {
    const res = appointmentRequestSchema.safeParse({ ...validBase, patientName: 'A' })
    expect(res.success).toBe(false)
  })

  it('rechaza notas que superan 500 caracteres', () => {
    const res = appointmentRequestSchema.safeParse({
      ...validBase,
      notes: 'x'.repeat(501),
    })
    expect(res.success).toBe(false)
  })

  it('convierte notas vacías o whitespace en undefined', () => {
    const parsed = appointmentRequestSchema.parse({ ...validBase, notes: '   ' })
    expect(parsed.notes).toBeUndefined()
  })

  it('reporta múltiples errores en un único pase', () => {
    const res = appointmentRequestSchema.safeParse({
      patientName: '',
      patientPhone: '',
      patientEmail: 'malo',
      service: 'No existe',
      preferredDate: 'no-fecha',
      timeWindow: 'tarde-noche',
      consentGiven: false,
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('patientName')
      expect(paths).toContain('patientEmail')
      expect(paths).toContain('service')
      expect(paths).toContain('consentGiven')
    }
  })
})

describe('toInsertPayload', () => {
  it('mapea camelCase a snake_case y preserva metadata', () => {
    const req = appointmentRequestSchema.parse(validBase)
    const payload = toInsertPayload(req, { sourceIp: '10.0.0.1', userAgent: 'vitest' })
    expect(payload).toMatchObject({
      patient_name: 'Ana Sofía Mejía',
      patient_phone: '+573147132470',
      patient_email: 'ana.mejia@example.com',
      service: SERVICES[0],
      time_window: 'morning',
      consent_given: true,
      source_ip: '10.0.0.1',
      user_agent: 'vitest',
      notes: 'Sensibilidad al frío',
    })
  })

  it('convierte notas opcionales en null cuando faltan', () => {
    const { notes: _notes, ...rest } = validBase
    const req = appointmentRequestSchema.parse(rest)
    const payload = toInsertPayload(req, { sourceIp: null, userAgent: null })
    expect(payload.notes).toBeNull()
    expect(payload.source_ip).toBeNull()
    expect(payload.user_agent).toBeNull()
  })
})

function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}
