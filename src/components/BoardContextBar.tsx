import { IconMap } from './ui/Icons'
import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'

/** Slim strip: active map / layer context above the tactical canvas. */
export default function BoardContextBar() {
  const mapId = useBoardStore((s) => s.mapId)
  const layerId = useBoardStore((s) => s.layerId)
  const customImage = useBoardStore((s) => s.customImage)
  const customImageName = useBoardStore((s) => s.customImageName)

  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null

  if (!customImage && !layer) return null

  return (
    <div className="board-context-bar">
      <IconMap size={14} className="shrink-0 text-highlight" />
      {customImage ? (
        <span className="board-context-title truncate">{customImageName || 'Custom image'}</span>
      ) : (
        <>
          <span className="board-context-title truncate">{map!.name}</span>
          <span className="board-context-sep">·</span>
          <span className="board-context-layer truncate">{layer!.name}</span>
          <span className="board-context-meta hidden sm:inline">
            <span className="text-blufor">{layer!.factions[0]}</span>
            <span className="text-zinc-600 mx-1">vs</span>
            <span className="text-opfor">{layer!.factions[1]}</span>
            <span className="text-zinc-600 mx-1.5">·</span>
            {layer!.mode}
            <span className="text-zinc-600 mx-1">·</span>
            {layer!.time}
            <span className="text-zinc-600 mx-1">·</span>
            {(map!.sizeMeters / 1000).toFixed(1)} km
          </span>
        </>
      )}
    </div>
  )
}
