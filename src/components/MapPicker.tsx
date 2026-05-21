import { useState } from 'react'
import { MAPS } from '../data/maps'
import { useBoardStore } from '../store/useBoardStore'

export default function MapPicker({ onClose }: { onClose: () => void }) {
  const { setMap, mapId } = useBoardStore()
  const [activeMap, setActiveMap] = useState(mapId ?? MAPS[0].id)
  const map = MAPS.find((m) => m.id === activeMap) ?? MAPS[0]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[760px] max-w-[94vw] max-h-[86vh] bg-panel border border-edge rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="font-semibold">Select Map &amp; Layer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* maps list */}
          <div className="w-48 shrink-0 border-r border-edge overflow-y-auto">
            {MAPS.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMap(m.id)}
                className={`block w-full text-left px-3 py-2 text-sm border-b border-edge/50 ${
                  activeMap === m.id ? 'bg-blue-600/20 text-white' : 'text-gray-300 hover:bg-panel2'
                }`}
              >
                {m.name}
                <span className="block text-[10px] text-gray-500">{m.layers.length} layers</span>
              </button>
            ))}
          </div>

          {/* layers */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-sm text-gray-400 mb-2">
              {map.name} · {(map.sizeMeters / 1000).toFixed(1)} km
            </div>
            <div className="grid gap-2">
              {map.layers.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setMap(map.id, l.id)
                    onClose()
                  }}
                  className="text-left p-3 rounded bg-panel2 border border-edge hover:border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{l.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 text-blue-200">{l.mode}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    <span className="text-blufor">{l.factions[0]}</span> vs{' '}
                    <span className="text-opfor">{l.factions[1]}</span> · {l.time}
                    {l.capturePoints ? ` · ${l.capturePoints.length} CP` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
