// Client-side gate for the Admin panel. This is a deterrent, not real auth:
// the data is readable at the DB layer, so treat VITE_ADMIN_CODE as a shared
// secret for the room owner. Set it in .env.local. If unset, the gate is open
// (handy for local dev).
const CODE = import.meta.env.VITE_ADMIN_CODE as string | undefined
const SESSION_KEY = 'ct:admin:ok'

export function adminGateConfigured(): boolean {
  return Boolean(CODE && CODE.length > 0)
}

export function isAdminUnlocked(): boolean {
  if (!adminGateConfigured()) return true
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

/** Prompts for the passcode when needed. Returns true when access is granted. */
export function unlockAdmin(): boolean {
  if (isAdminUnlocked()) return true
  const entry = window.prompt('Admin passcode:')
  if (entry == null) return false
  if (entry === CODE) {
    sessionStorage.setItem(SESSION_KEY, '1')
    return true
  }
  window.alert('Wrong passcode.')
  return false
}
