import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { ASSET_BY_ID } from '../data/assets'
import type { BoardElement } from '../types'

const TYPE_GLYPH: Record<BoardElement['type'], string> = {
  icon: '◈',
  arrow: '↗',
  line: '╱',
  pen: '∿',
  measure: '↔',
  range: '◉',
  rect: '▭',
  circle: '◯',
  zone: '⬠',
  text: 'T',
}

function labelFor(el: BoardElement): string {
  if (el.name) return el.name
  if (el.type === 'text') return el.text || 'Text'
  if (el.type === 'icon') return ASSET_BY_ID[el.assetId]?.name ?? 'Icon'
  return el.type.charAt(0).toUpperCase() + el.type.slice(1)
}

export default function LayersPanel() {
  const [open, setOpen] = useState(false)
  const elements = useBoardStore((s) => s.elements)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const setSelection = useBoardStore((s) => s.setSelection)
  const toggleHidden = useBoardStore((s) => s.toggleElementHidden)
  const toggleLocked = useBoardStore((s) => s.toggleElementLocked)
  const raise = useBoardStore((s) => s.raiseElement)
  const lower = useBoardStore((s) => s.lowerElement)
  const remove = useBoardStore((s) => s.removeElements)
  const rename = useBoardStore((s) => s.updateElement)

  const list = Object.values(elements).sort((a, b) => b.z - a.z) // top-most first

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 left-3 z-10 btn btn-active text-xs"
        title="Show layers"
      >
        ▤ Layers ({list.length})
      </button>
    )
  }

  return (
    <div className="absolute top-3 left-3 z-10 float-panel w-60 max-h-[70%] flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <span className="text-xs font-semibold tracking-wide text-gray-300">LAYERS</span>
        <span className="text-[10px] text-gray-500">{list.length}</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-gray-400 hover:text-white text-sm cursor-pointer" title="Hide">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {list.length === 0 && <div className="px-2 py-3 text-[11px] text-gray-600">No elements yet.</div>}
        {list.map((el) => {
          const selected = selectedIds.includes(el.id)
          return (
            <div
              key={el.id}
              onClick={() => setSelection([el.id])}
              className={`group flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer ${
                selected ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleHidden(el.id) }}
                title={el.hidden ? 'Show' : 'Hide'}
                className="w-5 text-center text-xs text-gray-400 hover:text-white"
              >
                {el.hidden ? '◌' : '👁'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleLocked(el.id) }}
                title={el.locked ? 'Unlock' : 'Lock'}
                className="w-5 text-center text-xs text-gray-400 hover:text-white"
              >
                {el.locked ? '🔒' : '🔓'}
              </button>
              <span className="w-4 text-center text-xs" style={{ color: el.color }}>{TYPE_GLYPH[el.type]}</span>
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  const n = window.prompt('Layer name:', labelFor(el))
                  if (n != null) rename(el.id, { name: n } as Partial<BoardElement>, true)
                }}
                className={`flex-1 truncate text-xs ${el.hidden ? 'text-gray-600 line-through' : 'text-gray-200'}`}
                title="Double-click to rename"
              >
                {labelFor(el)}
              </span>
              <div className="flex items-center opacity-0 group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); raise(el.id) }} title="Move up" className="w-4 text-xs text-gray-400 hover:text-white">▲</button>
                <button onClick={(e) => { e.stopPropagation(); lower(el.id) }} title="Move down" className="w-4 text-xs text-gray-400 hover:text-white">▼</button>
                <button onClick={(e) => { e.stopPropagation(); remove([el.id]) }} title="Delete" className="w-4 text-xs text-gray-400 hover:text-red-400">🗑</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
