import { supabase, isSupabaseConfigured } from './supabase'
import { roomMetaPollMs } from './supabaseTier'
import type { RoomPolicy } from './roomPolicy'

export interface RoomMeta {
  id: string
  title: string
  policy: RoomPolicy | null
  policyVersion: number
}

function client() {
  if (!supabase) return null
  return supabase
}

export async function fetchRoomMeta(roomId: string): Promise<RoomMeta | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb.from('rooms').select('id, title, policy, policy_version').eq('id', roomId).maybeSingle()
  if (error || !data) return null
  const policy = data.policy as RoomPolicy | null
  return {
    id: data.id,
    title: data.title ?? 'Untitled room',
    policy: policy?.roomId ? policy : null,
    policyVersion: Number(data.policy_version) || 0,
  }
}

export async function upsertRoomTitle(roomId: string, title: string): Promise<void> {
  const sb = client()
  if (!sb) return
  const t = title.trim() || 'Untitled room'
  await sb.from('rooms').upsert({ id: roomId, title: t, updated_at: new Date().toISOString() }, { onConflict: 'id' })
}

export async function upsertRoomPolicy(policy: RoomPolicy): Promise<void> {
  const sb = client()
  if (!sb) return
  await sb.from('rooms').upsert(
    {
      id: policy.roomId,
      policy,
      policy_version: policy.version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
}

/** Realtime postgres_changes (Pro-friendly). On Free, use pollRoomMeta instead. */
export function subscribeRoomMeta(roomId: string, onChange: (meta: RoomMeta) => void): () => void {
  const pollMs = roomMetaPollMs()
  if (pollMs > 0) return pollRoomMeta(roomId, onChange, pollMs)

  const sb = client()
  if (!sb) return () => {}

  const channel = sb
    .channel('room-meta:' + roomId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as {
          id: string
          title: string
          policy: RoomPolicy
          policy_version: number
        } | null
        if (!row?.id) return
        onChange({
          id: row.id,
          title: row.title ?? 'Untitled room',
          policy: row.policy?.roomId ? row.policy : null,
          policyVersion: Number(row.policy_version) || 0,
        })
      },
    )
    .subscribe()

  return () => {
    void sb.removeChannel(channel)
  }
}

/** Poll room row on an interval (saves Realtime quota on Free). */
export function pollRoomMeta(roomId: string, onChange: (meta: RoomMeta) => void, intervalMs: number): () => void {
  let lastKey = ''
  const tick = async () => {
    const meta = await fetchRoomMeta(roomId)
    if (!meta) return
    const key = `${meta.policyVersion}|${meta.title}`
    if (key === lastKey) return
    lastKey = key
    onChange(meta)
  }
  void tick()
  const id = setInterval(() => void tick(), intervalMs)
  return () => clearInterval(id)
}

export function isRoomCloudEnabled() {
  return isSupabaseConfigured
}
