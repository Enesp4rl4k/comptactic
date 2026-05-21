import { useState } from 'react'
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithOAuth,
  type OAuthProvider,
} from '../lib/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<null | 'email' | OAuthProvider>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy('email')
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password)
        onClose()
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password)
        if (needsConfirmation) setNotice('Check your email to confirm your account, then sign in.')
        else onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const oauth = async (provider: OAuthProvider) => {
    setError(null)
    setBusy(provider)
    try {
      await signInWithOAuth(provider) // redirects away on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth failed.')
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[380px] max-w-[94vw] bg-panel border border-edge rounded-lg overflow-hidden shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="font-display font-semibold tracking-wide">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!isSupabaseConfigured && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
              Supabase is not configured yet. Add your project URL and anon key to
              <code className="mx-1 rounded bg-black/30 px-1">.env.local</code> and restart.
            </div>
          )}

          {/* OAuth */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => oauth('discord')}
              disabled={!isSupabaseConfigured || busy !== null}
              className="btn"
              style={{ background: '#5865F2', borderColor: '#5865F2', color: '#fff' }}
            >
              {busy === 'discord' ? '…' : 'Discord'}
            </button>
            <button
              onClick={() => oauth('google')}
              disabled={!isSupabaseConfigured || busy !== null}
              className="btn"
            >
              {busy === 'google' ? '…' : 'Google'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <div className="h-px flex-1 bg-edge" />
            or
            <div className="h-px flex-1 bg-edge" />
          </div>

          {/* email + password */}
          <form onSubmit={submit} className="space-y-2">
            <div>
              <label htmlFor="auth-email" className="block text-[11px] text-gray-400 mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-[11px] text-gray-400 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="text-[12px] text-red-400">{error}</div>}
            {notice && <div className="text-[12px] text-emerald-400">{notice}</div>}

            <button type="submit" disabled={!isSupabaseConfigured || busy !== null} className="btn btn-primary w-full">
              {busy === 'email' ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="text-center text-[12px] text-gray-500">
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button onClick={() => { setMode('signup'); setError(null); setNotice(null) }} className="text-accent hover:underline cursor-pointer">
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError(null); setNotice(null) }} className="text-accent hover:underline cursor-pointer">
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
