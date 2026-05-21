import { useEffect, useRef, useState } from 'react'
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Line,
  Arrow,
  Circle,
  RegularPolygon,
  Text,
  Group,
  Transformer,
} from 'react-konva'
import type Konva from 'konva'
import { useBoardStore } from '../store/useBoardStore'
import { useImage } from '../lib/useImage'
import { MAP_BY_ID } from '../data/maps'
import { ASSET_BY_ID } from '../data/assets'
import type { BoardElement, IconElement, PolyElement } from '../types'

export const MAP_SIZE = 1024

interface Draft {
  type: 'arrow' | 'line' | 'pen' | 'measure' | 'rect' | 'circle'
  points: number[]
}

interface CommonProps {
  id: string
  draggable: boolean
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

export default function TacticalBoard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [draft, setDraft] = useState<Draft | null>(null)

  const {
    mapId,
    layerId,
    tool,
    team,
    color,
    strokeWidth,
    elements,
    selectedIds,
    addElement,
    updateElement,
    removeElements,
    setSelection,
    setTool,
    undo,
    redo,
  } = useBoardStore()

  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null
  const [bg, bgStatus] = useImage(map?.image ?? null)

  // --- responsive sizing ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // --- fit map to view when map changes ---
  useEffect(() => {
    if (!size.w) return
    const scale = Math.min(size.w / MAP_SIZE, size.h / MAP_SIZE) * 0.92
    setView({
      x: (size.w - MAP_SIZE * scale) / 2,
      y: (size.h - MAP_SIZE * scale) / 2,
      scale,
    })
  }, [mapId, size.w, size.h])

  // --- keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length) {
          e.preventDefault()
          removeElements(selectedIds)
        }
      } else if (e.key === 'Escape') {
        setSelection([])
        setDraft(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, undo, redo, removeElements, setSelection, setTool])

  // --- attach transformer to single selected transformable node ---
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    if (selectedIds.length === 1) {
      const node = stage.findOne('#' + selectedIds[0])
      tr.nodes(node ? [node] : [])
    } else {
      tr.nodes([])
    }
    tr.getLayer()?.batchDraw()
  }, [selectedIds, elements])

  const relPointer = (): { x: number; y: number } => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    return stage.getRelativePointerPosition() ?? { x: 0, y: 0 }
  }

  // --- wheel zoom toward pointer ---
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = view.scale
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePoint = {
      x: (pointer.x - view.x) / oldScale,
      y: (pointer.y - view.y) / oldScale,
    }
    const dir = e.evt.deltaY > 0 ? -1 : 1
    const factor = 1.1
    const newScale = Math.min(8, Math.max(0.15, dir > 0 ? oldScale * factor : oldScale / factor))
    setView({
      scale: newScale,
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale,
    })
  }

  const isDrawingTool = tool !== 'select'

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // text tool: place on click
    if (tool === 'text') {
      const p = relPointer()
      const text = window.prompt('Metin:')
      if (text) {
        addElement({ type: 'text', x: p.x, y: p.y, text, fontSize: 22, team, color, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
      }
      return
    }
    if (!isDrawingTool) {
      // clicking empty stage clears selection (pan handled by stage drag)
      if (e.target === e.target.getStage()) setSelection([])
      return
    }
    const p = relPointer()
    if (tool === 'rect' || tool === 'circle') {
      setDraft({ type: tool, points: [p.x, p.y, p.x, p.y] })
    } else if (tool === 'pen') {
      setDraft({ type: 'pen', points: [p.x, p.y] })
    } else {
      setDraft({ type: tool, points: [p.x, p.y, p.x, p.y] })
    }
  }

  const onMouseMove = () => {
    if (!draft) return
    const p = relPointer()
    setDraft((d) => {
      if (!d) return d
      if (d.type === 'pen') return { ...d, points: [...d.points, p.x, p.y] }
      return { ...d, points: [d.points[0], d.points[1], p.x, p.y] }
    })
  }

  const onMouseUp = () => {
    if (!draft) return
    const d = draft
    setDraft(null)
    const moved = Math.hypot(d.points[2] - d.points[0], d.points[3] - d.points[1])
    if (d.type === 'rect') {
      const [x1, y1, x2, y2] = d.points
      if (Math.abs(x2 - x1) < 4 || Math.abs(y2 - y1) < 4) return
      addElement({
        type: 'rect',
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        team,
        color,
        rotation: 0,
      } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'circle') {
      const [x1, y1, x2, y2] = d.points
      const r = Math.hypot(x2 - x1, y2 - y1)
      if (r < 4) return
      addElement({ type: 'circle', x: x1, y: y1, radius: r, team, color, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'pen') {
      if (d.points.length < 4) return
      addElement({ type: 'pen', points: d.points, strokeWidth, team, color, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    } else {
      // arrow / line / measure
      if (moved < 4) return
      addElement({ type: d.type, points: d.points, strokeWidth, team, color, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    }
  }

  // --- drop assets from palette ---
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const assetId = e.dataTransfer.getData('assetId')
    if (!assetId) return
    const stage = stageRef.current
    if (!stage) return
    stage.setPointersPositions(e)
    const p = stage.getRelativePointerPosition()
    if (!p) return
    const asset = ASSET_BY_ID[assetId]
    addElement({
      type: 'icon',
      x: p.x,
      y: p.y,
      assetId,
      scale: 1,
      team,
      color: asset?.teamColored ? color : asset?.fixedColor ?? color,
      rotation: 0,
    } as Omit<BoardElement, 'id' | 'z'>)
  }

  const ordered = Object.values(elements).sort((a, b) => a.z - b.z)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0c0f14]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {!map && (
        <div className="absolute inset-0 grid place-items-center text-center text-gray-500">
          <div>
            <div className="text-5xl mb-3">🗺️</div>
            <p className="text-lg">Başlamak için bir harita ve layer seç</p>
            <p className="text-sm text-gray-600">Sol üstteki “Harita Seç” butonu</p>
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        draggable={tool === 'select' && !draft}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
          }
        }}
        style={{ cursor: isDrawingTool ? 'crosshair' : 'default' }}
      >
        <Layer>
          {/* background */}
          {bg && bgStatus === 'loaded' ? (
            <KonvaImage image={bg} width={MAP_SIZE} height={MAP_SIZE} />
          ) : (
            <GridBackground />
          )}

          {/* capture points */}
          {layer?.capturePoints?.map((cp, i) => (
            <Group key={cp.id} x={cp.x * MAP_SIZE} y={cp.y * MAP_SIZE} listening={false}>
              <Circle radius={14} fill="rgba(234,179,8,0.25)" stroke="#eab308" strokeWidth={2} />
              <Circle radius={4} fill="#eab308" />
              <Text text={`${i + 1}. ${cp.name}`} fontSize={13} fill="#fde68a" x={18} y={-7} />
            </Group>
          ))}
        </Layer>

        <Layer>
          {ordered.map((el) => (
            <ElementView
              key={el.id}
              el={el}
              selectable={tool === 'select'}
              onSelect={() => tool === 'select' && setSelection([el.id])}
              onChange={(patch, commit) => updateElement(el.id, patch, commit)}
            />
          ))}

          {/* live draft preview */}
          {draft && <DraftView draft={draft} color={color} strokeWidth={strokeWidth} />}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <ZoomButton label="+" onClick={() => zoomBy(1.2)} />
        <ZoomButton label="−" onClick={() => zoomBy(1 / 1.2)} />
      </div>
    </div>
  )

  function zoomBy(factor: number) {
    setView((v) => {
      const newScale = Math.min(8, Math.max(0.15, v.scale * factor))
      const cx = size.w / 2
      const cy = size.h / 2
      const mx = (cx - v.x) / v.scale
      const my = (cy - v.y) / v.scale
      return { scale: newScale, x: cx - mx * newScale, y: cy - my * newScale }
    })
  }
}

function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 rounded bg-panel2/90 text-lg text-gray-200 border border-edge hover:bg-panel2"
    >
      {label}
    </button>
  )
}

function GridBackground() {
  const lines = []
  const step = MAP_SIZE / 16
  for (let i = 0; i <= 16; i++) {
    const p = i * step
    lines.push(
      <Line key={'h' + i} points={[0, p, MAP_SIZE, p]} stroke="#1e2530" strokeWidth={1} />,
      <Line key={'v' + i} points={[p, 0, p, MAP_SIZE]} stroke="#1e2530" strokeWidth={1} />,
    )
  }
  return (
    <Group listening={false}>
      <Rect width={MAP_SIZE} height={MAP_SIZE} fill="#10151c" />
      {lines}
      <Rect width={MAP_SIZE} height={MAP_SIZE} stroke="#2a3340" strokeWidth={2} />
    </Group>
  )
}

function DraftView({ draft, color, strokeWidth }: { draft: Draft; color: string; strokeWidth: number }) {
  if (draft.type === 'arrow' || draft.type === 'measure')
    return <Arrow points={draft.points} stroke={color} fill={color} strokeWidth={strokeWidth} pointerLength={14} pointerWidth={14} dash={draft.type === 'measure' ? [8, 6] : undefined} />
  if (draft.type === 'line') return <Line points={draft.points} stroke={color} strokeWidth={strokeWidth} />
  if (draft.type === 'pen') return <Line points={draft.points} stroke={color} strokeWidth={strokeWidth} lineCap="round" lineJoin="round" tension={0.3} />
  if (draft.type === 'rect') {
    const [x1, y1, x2, y2] = draft.points
    return <Rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} stroke={color} strokeWidth={strokeWidth} />
  }
  if (draft.type === 'circle') {
    const [x1, y1, x2, y2] = draft.points
    return <Circle x={x1} y={y1} radius={Math.hypot(x2 - x1, y2 - y1)} stroke={color} strokeWidth={strokeWidth} />
  }
  return null
}

interface ElementViewProps {
  el: BoardElement
  selectable: boolean
  onSelect: () => void
  onChange: (patch: Partial<BoardElement>, commit?: boolean) => void
}

function ElementView({ el, selectable, onSelect, onChange }: ElementViewProps) {
  const common: CommonProps = {
    id: el.id,
    draggable: selectable,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (selectable) {
        e.cancelBubble = true
        onSelect()
      }
    },
  }

  if (el.type === 'pen' || el.type === 'line' || el.type === 'arrow' || el.type === 'measure') {
    const poly = el as PolyElement
    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x()
      const dy = e.target.y()
      e.target.position({ x: 0, y: 0 })
      const shifted = poly.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      onChange({ points: shifted } as Partial<BoardElement>)
    }
    const stroke = poly.color
    if (poly.type === 'arrow' || poly.type === 'measure') {
      return (
        <>
          <Arrow {...common} points={poly.points} stroke={stroke} fill={stroke} strokeWidth={poly.strokeWidth} pointerLength={14} pointerWidth={14} dash={poly.type === 'measure' ? [8, 6] : undefined} hitStrokeWidth={16} onDragEnd={onDragEnd} />
          {poly.type === 'measure' && <MeasureLabel points={poly.points} />}
        </>
      )
    }
    return (
      <Line {...common} points={poly.points} stroke={stroke} strokeWidth={poly.strokeWidth} lineCap="round" lineJoin="round" tension={poly.type === 'pen' ? 0.3 : 0} hitStrokeWidth={16} onDragEnd={onDragEnd} />
    )
  }

  if (el.type === 'rect') {
    return (
      <Rect
        {...common}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        stroke={el.color}
        strokeWidth={3}
        fill={el.color + '22'}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const sx = node.scaleX()
          const sy = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange({ x: node.x(), y: node.y(), width: Math.max(8, el.width * sx), height: Math.max(8, el.height * sy), rotation: node.rotation() } as Partial<BoardElement>)
        }}
      />
    )
  }

  if (el.type === 'circle') {
    return (
      <Circle
        {...common}
        x={el.x}
        y={el.y}
        radius={el.radius}
        rotation={el.rotation}
        stroke={el.color}
        strokeWidth={3}
        fill={el.color + '22'}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const s = node.scaleX()
          node.scaleX(1)
          node.scaleY(1)
          onChange({ x: node.x(), y: node.y(), radius: Math.max(6, el.radius * s) } as Partial<BoardElement>)
        }}
      />
    )
  }

  if (el.type === 'text') {
    return (
      <Text
        {...common}
        x={el.x}
        y={el.y}
        text={el.text}
        fontSize={el.fontSize}
        fontStyle="bold"
        fill={el.color}
        rotation={el.rotation}
        onDblClick={() => {
          const t = window.prompt('Metin:', el.text)
          if (t != null) onChange({ text: t } as Partial<BoardElement>)
        }}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const s = node.scaleX()
          node.scaleX(1)
          node.scaleY(1)
          onChange({ x: node.x(), y: node.y(), fontSize: Math.max(8, el.fontSize * s), rotation: node.rotation() } as Partial<BoardElement>)
        }}
      />
    )
  }

  // icon
  return <IconView el={el as IconElement} common={common} onChange={onChange} />
}

function MeasureLabel({ points }: { points: number[] }) {
  const [x1, y1, x2, y2] = points
  const dist = Math.hypot(x2 - x1, y2 - y1)
  const meters = useBoardStore.getState()
  const map = meters.mapId ? MAP_BY_ID[meters.mapId] : null
  const m = map ? Math.round((dist / MAP_SIZE) * map.sizeMeters) : Math.round(dist)
  return (
    <Text
      x={(x1 + x2) / 2 + 6}
      y={(y1 + y2) / 2 - 18}
      text={`${m} m`}
      fontSize={14}
      fontStyle="bold"
      fill="#fde68a"
      listening={false}
    />
  )
}

function IconView({
  el,
  common,
  onChange,
}: {
  el: IconElement
  common: CommonProps
  onChange: (patch: Partial<BoardElement>, commit?: boolean) => void
}) {
  const asset = ASSET_BY_ID[el.assetId]
  const fill = el.color
  const R = 18
  const shape = asset?.shape ?? 'circle'
  return (
    <Group
      {...common}
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      scaleX={el.scale}
      scaleY={el.scale}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
        const node = e.target
        const s = node.scaleX()
        node.scaleX(1)
        node.scaleY(1)
        onChange({ x: node.x(), y: node.y(), scale: Math.max(0.4, el.scale * s), rotation: node.rotation() } as Partial<BoardElement>)
      }}
    >
      {shape === 'circle' && <Circle radius={R} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'square' && <Rect width={R * 2} height={R * 2} offsetX={R} offsetY={R} cornerRadius={4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'diamond' && <RegularPolygon sides={4} radius={R + 4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      <Text text={asset?.glyph ?? '?'} fontSize={20} align="center" verticalAlign="middle" width={R * 2} height={R * 2} offsetX={R} offsetY={R} />
      {el.label && <Text text={el.label} fontSize={12} fontStyle="bold" fill="#fff" align="center" width={120} offsetX={60} y={R + 4} />}
    </Group>
  )
}
