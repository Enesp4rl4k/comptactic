/**
 * Defaults tuned for Supabase Free (no Pro subscription).
 * Set VITE_SUPABASE_FREE_TIER=0 in .env when you upgrade to Pro and want faster sync.
 */
export function isSupabaseFreeTier(): boolean {
  return import.meta.env.VITE_SUPABASE_FREE_TIER !== '0'
}

/** Max save history rows kept per room in DB (trigger) and in UI lists. */
export const FREE_ROOM_VERSION_MAX = 12

export const collabTiming = () => {
  const free = isSupabaseFreeTier()
  return {
    boardDebounceIdleMs: free ? 180 : 120,
    boardDebounceDrawMs: free ? 450 : 320,
    rosterDebounceMs: free ? 400 : 280,
    fullSyncIntervalMs: free ? 30_000 : 12_000,
    minBoardSendMs: free ? 140 : 90,
    minRosterSendMs: free ? 280 : 180,
  }
}

export const presenceTiming = () => {
  const free = isSupabaseFreeTier()
  return {
    cursorIntervalMs: free ? 10_000 : 5_000,
    policyIntervalMs: free ? 25_000 : 8_000,
  }
}

/** Room title/policy: polling instead of postgres_changes saves Realtime quota on Free. */
export const roomMetaPollMs = () => (isSupabaseFreeTier() ? 45_000 : 0)
