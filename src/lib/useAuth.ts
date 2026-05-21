import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'

export type OAuthProvider = 'discord' | 'google'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
}

/** Subscribes to Supabase auth state. Safe no-op when Supabase isn't configured. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { user: session?.user ?? null, session, loading, configured: isSupabaseConfigured }
}

// --- actions (throw on error so callers can surface messages) ---

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
  // When email confirmation is on, no session is returned until the user confirms.
  return { needsConfirmation: !data.session }
}

export async function signInWithOAuth(provider: OAuthProvider) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}
