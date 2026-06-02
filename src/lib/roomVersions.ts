import { nanoid } from 'nanoid'
import { supabase, isSupabaseConfigured } from './supabase'
import { FREE_ROOM_VERSION_MAX, isSupabaseFreeTier } from './supabaseTier'
import type { BoardSnapshot } from '../types'

const LOCAL_KEY = (roomId: string) => `comptactic:room-versions:${roomId}`
const localMax = () => (isSupabaseFreeTier() ? FREE_ROOM_VERSION_MAX : 40)

/** Drop heavy inline map images from cloud snapshots (URLs kept). */
function snapshotForCloud(data: BoardSnapshot): BoardSnapshot {
  const img = data.customImage
  if (!img || /^https?:\/\//.test(img)) return data
  return { ...data, customImage: null, customImageName: data.customImageName ?? null }
}

export interface RoomVersionRow {
  id: string
  roomId: string
  label: string
  data: BoardSnapshot
  createdAt: string
  createdBy?: string | null
}

function loadLocal(roomId: string): RoomVersionRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(roomId))
    const arr = raw ? (JSON.parse(raw) as RoomVersionRow[]) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveLocal(roomId: string, rows: RoomVersionRow[]) {
  localStorage.setItem(LOCAL_KEY(roomId), JSON.stringify(rows.slice(0, localMax())))
}

/** Append a snapshot; never removes later versions when restoring an older one. */
export async function appendRoomVersion(
  roomId: string,
  label: string,
  data: BoardSnapshot,
  createdBy?: string | null,
): Promise<RoomVersionRow> {
  const row: RoomVersionRow = {
    id: nanoid(12),
    roomId,
    label: label.trim() || 'Save',
    data: structuredClone(isSupabaseConfigured ? snapshotForCloud(data) : data),
    createdAt: new Date().toISOString(),
    createdBy: createdBy ?? null,
  }

  if (supabase && isSupabaseConfigured) {
    await supabase.from('rooms').upsert({ id: roomId }, { onConflict: 'id' })
    const { data: auth } = await supabase.auth.getUser()
    const { data: inserted, error } = await supabase
      .from('room_versions')
      .insert({
        room_id: roomId,
        label: row.label,
        data: snapshotForCloud(row.data),
        created_by: auth.user?.id ?? null,
      })
      .select('id, room_id, label, data, created_at, created_by')
      .single()
    if (!error && inserted) {
      return {
        id: inserted.id,
        roomId: inserted.room_id,
        label: inserted.label,
        data: inserted.data as BoardSnapshot,
        createdAt: inserted.created_at,
        createdBy: inserted.created_by,
      }
    }
  }

  const next = [row, ...loadLocal(roomId)]
  saveLocal(roomId, next)
  return row
}

export async function listRoomVersions(roomId: string): Promise<RoomVersionRow[]> {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('room_versions')
      .select('id, room_id, label, data, created_at, created_by')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(localMax())
    if (!error && data?.length) {
      return data.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        label: r.label,
        data: r.data as BoardSnapshot,
        createdAt: r.created_at,
        createdBy: r.created_by,
      }))
    }
  }
  return loadLocal(roomId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getRoomVersion(versionId: string, roomId: string): Promise<RoomVersionRow | null> {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('room_versions')
      .select('id, room_id, label, data, created_at, created_by')
      .eq('id', versionId)
      .eq('room_id', roomId)
      .maybeSingle()
    if (!error && data) {
      return {
        id: data.id,
        roomId: data.room_id,
        label: data.label,
        data: data.data as BoardSnapshot,
        createdAt: data.created_at,
        createdBy: data.created_by,
      }
    }
  }
  return loadLocal(roomId).find((v) => v.id === versionId) ?? null
}
