import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Credentials come from Vite env vars. Copy .env.example to .env.local and fill in
// your project's values (Supabase dashboard -> Settings -> API).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when both env vars are present, so the UI can degrade gracefully. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** Shared client, or null when not configured (keeps the app usable offline). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
