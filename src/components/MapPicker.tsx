import { useMemo, useState } from 'react'
import { MAPS } from '../data/maps'
import { useBoardStore } from '../store/useBoardStore'
import { importCustomMap } from '../lib/customMap'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadRecentMaps, rememberLayer } from '../lib/recentMaps'
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
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[760px] max-w-[94vw] max-h-[86vh] bg-panel border border-edge rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <h2 className="font-display font-semibold tracking-wide">Select Map &amp; Layer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer ml-auto">
            ×
          </button>
        </div>

        {/* custom PNG map */}
        <div
          className="px-4 py-3 border-b border-edge bg-panel2/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropCustom}
        >
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Custom map (PNG)</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`btn h-8 px-3 text-xs cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
              {busy ? 'Uploading…' : 'Upload PNG'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} className="hidden" disabled={busy} />
            </label>
            <label className="text-xs text-gray-400 flex items-center gap-1.5">
              Map size
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={sizeKm}
                onChange={(e) => setSizeKm(e.target.value)}
                onBlur={onSizeKmBlur}
                className="w-14 h-7 px-1.5 rounded bg-panel border border-edge text-gray-200 text-xs"
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
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <span className="truncate">Active: {customImageName || 'Custom image'}</span>
              {customMapMeta && (
                <span className="shrink-0">
                  · {customMapMeta.naturalWidth}×{customMapMeta.naturalHeight}px
                </span>
              )}
            </div>
          )}
          <p className="text-[11px] text-gray-600 mt-1.5">Drop a PNG here or on the board. Max 8 MB.</p>
          {error && <p className="text-[11px] text-amber-400 mt-1">{error}</p>}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-48 shrink-0 border-r border-edge overflow-y-auto">
            {MAPS.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMap(m.id)}
                className={`block w-full text-left px-3 py-2 text-sm border-b border-edge/50 ${
                  activeMap === m.id ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-panel2'
                }`}
              >
                {m.name}
                <span className="block text-[10px] text-gray-500">{m.layers.length} layers</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
            {recent.length > 0 && (
              <div className="mb-3 shrink-0">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Recent</div>
                <div className="flex flex-wrap gap-1">
                  {recent.map((r) => (
                    <button
                      key={r.layerId}
                      type="button"
                      onClick={() => {
                        setMap(r.mapId, r.layerId)
                        onClose()
                      }}
                      className="h-7 px-2 rounded text-xs bg-panel2 border border-edge hover:border-accent truncate max-w-[12rem] cursor-pointer"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0">
              <span className="text-sm text-gray-400">
                {map.name} · {(map.sizeMeters / 1000).toFixed(1)} km
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search layers…"
                className="ml-auto h-7 flex-1 min-w-[8rem] max-w-[14rem] rounded bg-panel2 border border-edge px-2 text-xs outline-none focus:border-accent"
              />
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as GameMode | 'all')}
                className="h-7 rounded bg-panel2 border border-edge px-2 text-xs outline-none focus:border-accent"
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
                  onClick={() => {
                    setMap(map.id, l.id)
                    rememberLayer(map.id, l.id, `${map.name} · ${l.name}`)
                    onClose()
                  }}
                  className="text-left p-3 rounded-md bg-panel2 border border-edge hover:border-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">{l.mode}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    <span className="text-blufor">{l.factions[0]}</span> vs{' '}
                    <span className="text-opfor">{l.factions[1]}</span> · {l.time}
                    {l.capturePoints ? ` · ${l.capturePoints.length} CP` : ''}
                  </div>
                </button>
              ))}
              {filteredLayers.length === 0 && (
                <p className="text-sm text-gray-600 py-4 text-center">No layers match your filters.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
