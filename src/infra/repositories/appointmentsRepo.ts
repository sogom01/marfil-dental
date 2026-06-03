import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentRow } from '@/domain/scheduling/appointment'

/**
 * Repositorio de `appointments`. Usa la SERVICE_ROLE_KEY: solo debe importarse
 * desde código server-side (endpoints API). Nunca exponer a islas/cliente.
 */

let cachedClient: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = import.meta.env.SUPABASE_URL
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase no está configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.',
    )
  }

  cachedClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return cachedClient
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.SUPABASE_URL && import.meta.env.SUPABASE_SERVICE_ROLE_KEY)
}

export type NewAppointment = Omit<
  AppointmentRow,
  'id' | 'created_at' | 'updated_at' | 'status' | 'staff_notes' | 'confirmed_at' | 'confirmed_by'
>

export async function createAppointment(payload: NewAppointment): Promise<AppointmentRow> {
  const { data, error } = await getClient()
    .from('appointments')
    .insert(payload)
    .select('*')
    .single<AppointmentRow>()

  if (error) {
    throw new Error(`No se pudo crear la cita: ${error.message}`)
  }
  return data
}
