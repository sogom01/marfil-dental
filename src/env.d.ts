/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL?: string
  readonly SUPABASE_SERVICE_ROLE_KEY?: string
  readonly RESEND_API_KEY?: string
  readonly RESEND_FROM_EMAIL?: string
  readonly RESEND_NOTIFY_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
