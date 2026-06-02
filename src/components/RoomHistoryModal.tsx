import { useEffect, useState } from 'react'
import { listRoomVersions, getRoomVersion, type RoomVersionRow } from '../lib/roomVersions'
import type { BoardSnapshot } from '../types'

interface Props {
  open: boolean
  roomId: string
  onClose: () => void
  onRestore: (snap: BoardSnapshot, label: string) => void
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function RoomHistoryModal({ open, roomId, onClose, onRestore }: Props) {
  const [rows, setRows] = useState<RoomVersionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !roomId) return
    setLoading(true)
    void listRoomVersions(roomId)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [open, roomId])

  if (!open) return null

  const restore = async (id: string) => {
    setBusyId(id)
    try {
      const row = await getRoomVersion(id, roomId)
      if (!row) return
      if (!window.confirm(`Restore “${row.label}” from ${formatWhen(row.createdAt)}?\n\nNewer saves stay in history — nothing is deleted.`)) {
        return
      }
      onRestore(row.data, row.label)
      onClose()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-[520px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Room history</h2>
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost ml-auto text-lg leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-4 max-h-[65vh] overflow-y-auto">
          <p className="text-xs text-zinc-500 mb-3">
            Every save is kept. Restoring loads an older snapshot; later saves remain available.
          </p>
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-zinc-500">No saved versions yet. Use Save to create the first checkpoint.</p>
          )}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg border border-edge bg-panel2/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-200 truncate">{r.label}</div>
                  <div className="text-[11px] text-zinc-600">{formatWhen(r.createdAt)}</div>
                </div>
                <button
                  type="button"
                  className="btn text-xs shrink-0"
                  disabled={busyId === r.id}
                  onClick={() => void restore(r.id)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
