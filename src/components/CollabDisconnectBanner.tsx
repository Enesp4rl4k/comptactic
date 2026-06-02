import { useBoardStore } from '../store/useBoardStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { isSupabaseFreeTier } from '../lib/supabaseTier'

/** Shown when Supabase Realtime drops (BroadcastChannel may still sync same device). */
export default function CollabDisconnectBanner() {
  const connected = useBoardStore((s) => s.collabConnected)

  if (!isSupabaseConfigured || connected) return null

  const freeHint = isSupabaseFreeTier()
    ? ' Tabs on this browser still sync. Remote teammates need the connection back.'
    : ''

  return (
    <div className="collab-offline-banner" role="status">
      Cloud sync paused — changes may not reach other devices until reconnected.{freeHint}
    </div>
  )
}
