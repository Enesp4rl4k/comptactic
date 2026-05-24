import { useMemo } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { ASSET_BY_ID } from '../data/assets'

/** Read-only timeline of vehicle route timings (sort by first time token). */
export default function SpawnTimeline() {
  const vehicles = useBoardStore((s) => s.vehicles)

  const rows = useMemo(() => {
    return vehicles
      .map((v) => {
        const asset = ASSET_BY_ID[v.assetId]
        const label = v.name || asset?.name || v.assetId
        const sortKey = parseTimingKey(v.timing ?? '')
        return { ...v, label, sortKey }
      })
      .sort((a, b) => a.sortKey - b.sortKey)
  }, [vehicles])

  if (!rows.length) return null

  return (
    <div className="border-b border-edge bg-panel2/50 shrink-0">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-edge/50">
        Vehicle timeline · {rows.length}
      </div>
      <div className="flex gap-2 overflow-x-auto p-2">
        {rows.map((v) => (
          <div key={v.id} className="shrink-0 min-w-[10rem] rounded border border-edge bg-panel px-2 py-1.5">
            <div className="text-xs font-medium text-gray-200 truncate">{v.label}</div>
            <div className="text-[11px] text-amber-200/90 mt-0.5 tabular-nums">{v.timing || '— no timing —'}</div>
            {v.squadIds.length > 0 && (
              <div className="text-[10px] text-gray-500 mt-1">Squads: {v.squadIds.length}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Extract first mm:ss style token as sortable seconds. */
function parseTimingKey(timing: string): number {
  const m = timing.match(/(\d{1,2}):(\d{2})/)
  if (!m) return Number.MAX_SAFE_INTEGER
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}
