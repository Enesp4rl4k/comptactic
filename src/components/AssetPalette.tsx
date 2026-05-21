import { ASSETS, CATEGORY_LABELS, type AssetCategory } from '../data/assets'
import { useBoardStore } from '../store/useBoardStore'

const ORDER: AssetCategory[] = ['infantry', 'deployable', 'vehicle', 'marker']

export default function AssetPalette() {
  const { team, color } = useBoardStore()

  return (
    <div className="w-56 shrink-0 bg-panel border-l border-edge overflow-y-auto">
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 border-b border-edge">
        Comp Componentleri
      </div>
      <div className="p-2 text-[11px] text-gray-500">Haritaya sürükle-bırak.</div>
      {ORDER.map((cat) => (
        <div key={cat} className="px-2 pb-3">
          <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">{CATEGORY_LABELS[cat]}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {ASSETS.filter((a) => a.category === cat).map((a) => {
              const badge = a.teamColored ? color : a.fixedColor ?? '#888'
              return (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('assetId', a.id)}
                  title={a.name}
                  className="flex flex-col items-center gap-1 p-1.5 rounded bg-panel2 border border-edge hover:border-blue-500 cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="h-8 w-8 grid place-items-center text-lg rounded-full border border-black/50"
                    style={{
                      background: badge,
                      borderRadius: a.shape === 'square' ? 6 : a.shape === 'diamond' ? 4 : 999,
                      transform: a.shape === 'diamond' ? 'rotate(45deg)' : undefined,
                    }}
                  >
                    <span style={{ transform: a.shape === 'diamond' ? 'rotate(-45deg)' : undefined }}>{a.glyph}</span>
                  </div>
                  <span className="text-[9px] text-gray-400 text-center leading-tight">{a.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="px-3 py-2 text-[10px] text-gray-600 border-t border-edge">
        Aktif takım: <span style={{ color }}>{team.toUpperCase()}</span>
      </div>
    </div>
  )
}
