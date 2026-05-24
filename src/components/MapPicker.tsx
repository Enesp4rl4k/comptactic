import { useMemo, useState } from 'react'
import { MAPS } from '../data/maps'
import { useBoardStore } from '../store/useBoardStore'
import { importCustomMap } from '../lib/customMap'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadRecentMaps, rememberLayer } from '../lib/recentMaps'
import { IconClose } from './ui/Icons'
import type { GameMode } from '../types'

export default function MapPicker({ onClose }: { onClose: () => void }) {
  const { setMap, mapId, customImage, customImageName, customMapMeta, setCustomImage, clearCustomImage, setCustomMapSizeMeters } =
    useBoardStore()
  const [activeMap, setActiveMap] = useState(mapId ?? MAPS[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sizeKm, setSizeKm] = useState(() => ((customMapMeta?.sizeMeters ?? 4000) / 1000).toFixed(1))
  const [query, setQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<GameMode | 'all'>('all')
  const recent = loadRecentMaps()
  const map = MAPS.find((m) => m.id === activeMap) ?? MAPS[0]

  const filteredLayers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return map.layers.filter((l) => {
      if (modeFilter !== 'all' && l.mode !== modeFilter) return false
      if (!q) return true
      const hay = `${l.name} ${l.factions.join(' ')} ${l.mode} ${l.time}`.toLowerCase()
      return hay.includes(q)
    })
  }, [map.layers, query, modeFilter])

  const applyFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const km = parseFloat(sizeKm)
      const sizeMeters = Number.isFinite(km) && km > 0 ? km * 1000 : 4000
      const r = await importCustomMap(file, sizeMeters)
      setCustomImage(r.url, r.name, r.meta)
      setSizeKm((r.meta.sizeMeters / 1000).toFixed(1))
      if (r.localOnly && isSupabaseConfigured) {
        setError('Saved locally — sign in before Share so others see your custom map.')
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void applyFile(file)
    e.target.value = ''
  }

  const onDropCustom = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void applyFile(file)
  }

  const onSizeKmBlur = () => {
    const km = parseFloat(sizeKm)
    if (Number.isFinite(km) && km > 0 && customMapMeta) setCustomMapSizeMeters(km * 1000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-[760px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Select map &amp; layer</h2>
          <button type="button" onClick={onClose} className="btn btn-icon btn-ghost ml-auto" aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div
          className="px-4 py-3 border-b border-edge bg-panel2/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropCustom}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Custom map (PNG)</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`btn h-8 px-3 text-xs cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
              {busy ? 'Uploading…' : 'Upload PNG'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} className="hidden" disabled={busy} />
            </label>
            <label className="text-xs text-zinc-500 flex items-center gap-1.5">
              Map size
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={sizeKm}
                onChange={(e) => setSizeKm(e.target.value)}
                onBlur={onSizeKmBlur}
                className="w-14 h-7 px-1.5 rounded-lg bg-panel border border-edge text-zinc-200 text-xs"
              />
              km
            </label>
            {customImage && (
              <button type="button" onClick={() => clearCustomImage()} className="btn h-8 px-3 text-xs">
                Remove custom
              </button>
            )}
          </div>
          {customImage && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <span className="truncate">Active: {customImageName || 'Custom image'}</span>
              {customMapMeta && (
                <span className="shrink-0">
                  · {customMapMeta.naturalWidth}×{customMapMeta.naturalHeight}px
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-zinc-600 mt-1.5">Drop a PNG here or on the board. Max 8 MB.</p>
          {error && <p className="text-[11px] text-amber-400 mt-1">{error}</p>}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-48 shrink-0 border-r border-edge overflow-y-auto">
            {MAPS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMap(m.id)}
                className={`map-nav-item ${activeMap === m.id ? 'map-nav-item-active' : 'map-nav-item-idle'}`}
              >
                {m.name}
                <span className="block text-[10px] text-zinc-600 mt-0.5">{m.layers.length} layers</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
            {recent.length > 0 && (
              <div className="mb-3 shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Recent</div>
                <div className="flex flex-wrap gap-1">
                  {recent.map((r) => (
                    <button
                      key={r.layerId}
                      type="button"
                      onClick={() => {
                        setMap(r.mapId, r.layerId)
                        onClose()
                      }}
                      className="chip"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
              <span className="text-sm text-zinc-400">
                {map.name} · {(map.sizeMeters / 1000).toFixed(1)} km
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search layers…"
                className="input ml-auto h-8 flex-1 min-w-[8rem] max-w-[14rem] !py-1 text-xs"
              />
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as GameMode | 'all')}
                className="h-8 rounded-lg bg-panel2 border border-edge px-2 text-xs text-zinc-300 outline-none focus:border-highlight/60"
              >
                <option value="all">All modes</option>
                <option value="AAS">AAS</option>
                <option value="Skirmish">Skirmish</option>
              </select>
            </div>
            <div className="grid gap-2">
              {filteredLayers.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setMap(map.id, l.id)
                    rememberLayer(map.id, l.id, `${map.name} · ${l.name}`)
                    onClose()
                  }}
                  className="layer-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100">{l.name}</span>
                    <span className="badge-mode">{l.mode}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    <span className="text-blufor">{l.factions[0]}</span>
                    <span className="text-zinc-600"> vs </span>
                    <span className="text-opfor">{l.factions[1]}</span>
                    <span className="text-zinc-600"> · {l.time}</span>
                  </div>
                </button>
              ))}
              {filteredLayers.length === 0 && (
                <p className="text-sm text-zinc-600 py-8 text-center">No layers match your filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
