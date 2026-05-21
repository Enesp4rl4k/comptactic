import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { useTintedIcon } from '../lib/useTintedIcon'
import { simplifyPoints } from '../lib/simplify'
import { MAP_BY_ID } from '../data/maps'
import { ASSET_BY_ID } from '../data/assets'
import type { BoardElement, IconElement, PolyElement } from '../types'

export const MAP_SIZE = 1024
const PEN_MIN_DIST = 3 // stage units between captured freehand points

interface Draft {
  type: 'arrow' | 'line' | 'pen' | 'measure' | 'rect' | 'circle'
  points: number[]
}

interface CommonProps {
  id: string
  draggable: boolean
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void
}

export default function TacticalBoard({ readOnly = false }: { readOnly?: boolean } = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const lastPenRef = useRef<{ x: number; y: number } | null>(null)

  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [draft, setDraft] = useState<Draft | null>(null)
  // in-progress zone polygon: committed vertices + live cursor position
  const [poly, setPoly] = useState<{ pts: number[]; cx: number; cy: number } | null>(null)

  const mapId = useBoardStore((s) => s.mapId)
  const layerId = useBoardStore((s) => s.layerId)
  const tool = useBoardStore((s) => s.tool)
  const team = useBoardStore((s) => s.team)
  const color = useBoardStore((s) => s.color)
  const strokeWidth = useBoardStore((s) => s.strokeWidth)
  const elements = useBoardStore((s) => s.elements)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const addElement = useBoardStore((s) => s.addElement)
  const updateElement = useBoardStore((s) => s.updateElement)
  const removeElements = useBoardStore((s) => s.removeElements)
  const setSelection = useBoardStore((s) => s.setSelection)
  const setTool = useBoardStore((s) => s.setTool)
  const undo = useBoardStore((s) => s.undo)
  const redo = useBoardStore((s) => s.redo)

  const customImage = useBoardStore((s) => s.customImage)
  const setCustomImage = useBoardStore((s) => s.setCustomImage)
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null
  const [bg, bgStatus] = useImage(customImage ?? layer?.image ?? null)
  const hasBg = Boolean(customImage || layer)

  // stable callbacks for memoized elements
  const handleSelect = useCallback((id: string) => setSelection([id]), [setSelection])
  const handleChange = useCallback(
    (id: string, patch: Partial<BoardElement>, commit?: boolean) => updateElement(id, patch, commit),
    [updateElement],
  )

  // --- responsive sizing ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
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
        setPoly(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, undo, redo, removeElements, setSelection, setTool])

  // Paste an image (Ctrl+V) to use it as a custom board background.
  useEffect(() => {
    if (readOnly) return
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => setCustomImage(reader.result as string, 'Pasted image')
      reader.readAsDataURL(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [readOnly, setCustomImage])

  // Zone tool: Enter finishes the polygon; switching tools cancels it.
  useEffect(() => {
    if (tool !== 'zone') {
      setPoly(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && poly) {
        e.preventDefault()
        finalizeZone(poly.pts)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, poly])

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
    const mousePoint = { x: (pointer.x - view.x) / oldScale, y: (pointer.y - view.y) / oldScale }
    const dir = e.evt.deltaY > 0 ? -1 : 1
    const factor = 1.1
    const newScale = Math.min(8, Math.max(0.15, dir > 0 ? oldScale * factor : oldScale / factor))
    setView({ scale: newScale, x: pointer.x - mousePoint.x * newScale, y: pointer.y - mousePoint.y * newScale })
  }

  const isDrawingTool = tool !== 'select'

  // Effective placement color/label: use the active squad's color when one is
  // selected in the palette, otherwise the current tool color.
  const effDraw = () => {
    const st = useBoardStore.getState()
    const sq = st.squads.find((s) => s.id === st.activeSquadId) ?? null
    return {
      color: sq ? sq.color : st.color,
      label: sq ? `S${st.squads.indexOf(sq) + 1}` : undefined,
      rosterSquadId: sq?.id,
    }
  }

  const finalizeZone = (pts: number[]) => {
    if (pts.length < 6) {
      setPoly(null)
      return
    }
    const { color: c, label, rosterSquadId } = effDraw()
    addElement({ type: 'zone', points: pts, team, color: c, rotation: 0, label, rosterSquadId } as Omit<BoardElement, 'id' | 'z'>)
    setPoly(null)
  }

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly) return
    if (tool === 'zone') {
      const p = relPointer()
      // close when clicking near the first vertex
      if (poly && poly.pts.length >= 6) {
        const dx = p.x - poly.pts[0]
        const dy = p.y - poly.pts[1]
        if (Math.hypot(dx, dy) < 12 / view.scale) {
          finalizeZone(poly.pts)
          return
        }
      }
      setPoly(poly ? { pts: [...poly.pts, p.x, p.y], cx: p.x, cy: p.y } : { pts: [p.x, p.y], cx: p.x, cy: p.y })
      return
    }
    if (tool === 'text') {
      const p = relPointer()
      const text = window.prompt('Text:')
      if (text)
        addElement({ type: 'text', x: p.x, y: p.y, text, fontSize: 22, team, color: effDraw().color, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
      return
    }
    if (!isDrawingTool) {
      if (e.target === e.target.getStage()) setSelection([])
      return
    }
    const p = relPointer()
    if (tool === 'pen') {
      lastPenRef.current = p
      setDraft({ type: 'pen', points: [p.x, p.y] })
    } else {
      setDraft({ type: tool, points: [p.x, p.y, p.x, p.y] })
    }
  }

  const onMouseMove = () => {
    if (tool === 'zone') {
      if (poly) {
        const p = relPointer()
        setPoly({ ...poly, cx: p.x, cy: p.y })
      }
      return
    }
    if (!draft) return
    const p = relPointer()
    if (draft.type === 'pen') {
      const last = lastPenRef.current
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < PEN_MIN_DIST) return
      lastPenRef.current = p
      setDraft((d) => (d ? { ...d, points: [...d.points, p.x, p.y] } : d))
    } else {
      setDraft((d) => (d ? { ...d, points: [d.points[0], d.points[1], p.x, p.y] } : d))
    }
  }

  const onMouseUp = () => {
    if (!draft) return
    const d = draft
    setDraft(null)
    lastPenRef.current = null
    // measurement keeps its own styling; everything else adopts the squad color
    const drawColor = d.type === 'measure' ? color : effDraw().color
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
        color: drawColor,
        rotation: 0,
      } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'circle') {
      const [x1, y1, x2, y2] = d.points
      const r = Math.hypot(x2 - x1, y2 - y1)
      if (r < 4) return
      addElement({ type: 'circle', x: x1, y: y1, radius: r, team, color: drawColor, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'pen') {
      if (d.points.length < 4) return
      const pts = simplifyPoints(d.points, 2)
      addElement({ type: 'pen', points: pts, strokeWidth, team, color: drawColor, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    } else {
      const moved = Math.hypot(d.points[2] - d.points[0], d.points[3] - d.points[1])
      if (moved < 4) return
      addElement({ type: d.type, points: d.points, strokeWidth, team, color: drawColor, rotation: 0 } as Omit<BoardElement, 'id' | 'z'>)
    }
  }

  // --- drop assets from palette (squad-aware coloring + label) ---
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (readOnly) return
    const assetId = e.dataTransfer.getData('assetId')
    if (!assetId) return
    const stage = stageRef.current
    if (!stage) return
    stage.setPointersPositions(e)
    const p = stage.getRelativePointerPosition()
    if (!p) return
    const asset = ASSET_BY_ID[assetId]
    const st = useBoardStore.getState()
    const activeSquad = st.squads.find((s) => s.id === st.activeSquadId) ?? null

    let iconColor: string
    let label: string | undefined
    let rosterSquadId: string | undefined
    if (activeSquad) {
      iconColor = activeSquad.color
      label = `S${st.squads.indexOf(activeSquad) + 1}`
      rosterSquadId = activeSquad.id
    } else {
      iconColor = asset?.teamColored ? st.color : asset?.fixedColor ?? st.color
    }

    addElement({
      type: 'icon',
      x: p.x,
      y: p.y,
      assetId,
      scale: 1,
      team: st.team,
      color: iconColor,
      rotation: 0,
      label,
      rosterSquadId,
    } as Omit<BoardElement, 'id' | 'z'>)
  }

  const ordered = useMemo(() => Object.values(elements).sort((a, b) => a.z - b.z), [elements])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0c0f14]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {!hasBg && (
        <div className="absolute inset-0 grid place-items-center text-center text-gray-500 pointer-events-none">
          <div>
            <div className="text-5xl mb-3">🗺️</div>
            <p className="text-lg">Select a map or upload your own image</p>
            <p className="text-sm text-gray-600">Use “Select Map”, or paste an image (Ctrl+V)</p>
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
        draggable={readOnly ? true : tool === 'select' && !draft}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDblClick={() => {
          if (tool === 'zone' && poly) finalizeZone(poly.pts)
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
        }}
        style={{ cursor: readOnly ? 'grab' : isDrawingTool ? 'crosshair' : 'default' }}
      >
        {/* base layer: background + capture points (static) */}
        <Layer listening={false}>
          {bg && bgStatus === 'loaded' ? <BackgroundImage img={bg} /> : <GridBackground />}
          {layer?.capturePoints?.map((cp, i) => (
            <Group key={cp.id} x={cp.x * MAP_SIZE} y={cp.y * MAP_SIZE}>
              <Circle radius={14} fill="rgba(234,179,8,0.25)" stroke="#eab308" strokeWidth={2} />
              <Circle radius={4} fill="#eab308" />
              <Text text={`${i + 1}. ${cp.name}`} fontSize={13} fill="#fde68a" x={18} y={-7} />
            </Group>
          ))}
        </Layer>

        {/* elements layer (memoized children -> not redrawn while drafting) */}
        <Layer>
          {ordered.map((el) => (
            <ElementView key={el.id} el={el} selectable={!readOnly && tool === 'select'} onSelect={handleSelect} onChange={handleChange} />
          ))}
          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
          />
        </Layer>

        {/* draft layer: only the in-progress shape re-renders here */}
        <Layer listening={false}>
          {draft && <DraftView draft={draft} color={color} strokeWidth={strokeWidth} mapSize={map?.sizeMeters ?? null} />}
          {poly && <ZoneDraft poly={poly} color={effDraw().color} />}
        </Layer>
      </Stage>

      {!readOnly && <SelectionBar />}

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
    <button onClick={onClick} className="h-9 w-9 rounded bg-panel2/90 text-lg text-gray-200 border border-edge hover:bg-panel2">
      {label}
    </button>
  )
}

const SELECTION_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7', '#f97316', '#ffffff', '#0b0e13']

/** Contextual editor for the single selected element: color + size. */
function SelectionBar() {
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const elements = useBoardStore((s) => s.elements)
  const updateElement = useBoardStore((s) => s.updateElement)
  const beginHistory = useBoardStore((s) => s.beginHistory)
  const bringToFront = useBoardStore((s) => s.bringToFront)
  const sendToBack = useBoardStore((s) => s.sendToBack)
  const removeElements = useBoardStore((s) => s.removeElements)

  if (selectedIds.length !== 1) return null
  const el = elements[selectedIds[0]]
  if (!el) return null
  const id = el.id

  const setColor = (c: string) => updateElement(id, { color: c } as Partial<BoardElement>, true)
  const live = (patch: Partial<BoardElement>) => updateElement(id, patch, false)

  let size: ReactNode = null
  if (el.type === 'icon') {
    size = <Slider label="Size" min={0.4} max={3} step={0.1} value={el.scale} onStart={beginHistory} onChange={(v) => live({ scale: v } as Partial<BoardElement>)} />
  } else if (el.type === 'pen' || el.type === 'line' || el.type === 'arrow' || el.type === 'measure') {
    size = <Slider label="Width" min={1} max={20} step={1} value={(el as PolyElement).strokeWidth} onStart={beginHistory} onChange={(v) => live({ strokeWidth: v } as Partial<BoardElement>)} />
  } else if (el.type === 'text') {
    size = <Slider label="Size" min={8} max={72} step={1} value={el.fontSize} onStart={beginHistory} onChange={(v) => live({ fontSize: v } as Partial<BoardElement>)} />
  }

  const hex = /^#[0-9a-fA-F]{6}$/.test(el.color) ? el.color : '#ffffff'

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-panel2/95 border border-edge rounded-lg px-3 py-1.5 shadow-lg backdrop-blur">
      <span className="text-[11px] text-gray-400">Color</span>
      <div className="flex items-center gap-1">
        {SELECTION_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-5 w-5 rounded-full border-2 ${el.color === c ? 'border-white' : 'border-black/40'}`}
            style={{ background: c }}
            title={c}
          />
        ))}
        <input
          type="color"
          value={hex}
          onChange={(e) => setColor(e.target.value)}
          title="Custom color"
          className="h-6 w-6 rounded cursor-pointer bg-transparent border border-edge p-0"
        />
      </div>
      {size && <div className="h-5 w-px bg-edge" />}
      {size}
      <div className="h-5 w-px bg-edge" />
      <button onClick={() => bringToFront(id)} title="Bring to front" className="h-7 w-7 grid place-items-center rounded border border-edge bg-panel text-gray-300 hover:bg-edge text-sm">⤒</button>
      <button onClick={() => sendToBack(id)} title="Send to back" className="h-7 w-7 grid place-items-center rounded border border-edge bg-panel text-gray-300 hover:bg-edge text-sm">⤓</button>
      <button onClick={() => removeElements([id])} title="Delete (Del)" className="h-7 w-7 grid place-items-center rounded border border-edge bg-panel text-gray-400 hover:text-red-400 hover:border-red-500 text-sm">🗑</button>
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onStart,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onStart: () => void
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-gray-300">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 accent-blue-500"
      />
    </label>
  )
}

/** Draws the background image contained within the MAP_SIZE square, preserving aspect. */
function BackgroundImage({ img }: { img: HTMLImageElement }) {
  const ar = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
  let w = MAP_SIZE
  let h = MAP_SIZE
  if (ar >= 1) h = MAP_SIZE / ar
  else w = MAP_SIZE * ar
  return <KonvaImage image={img} width={w} height={h} x={(MAP_SIZE - w) / 2} y={(MAP_SIZE - h) / 2} />
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
    <Group>
      <Rect width={MAP_SIZE} height={MAP_SIZE} fill="#10151c" />
      {lines}
      <Rect width={MAP_SIZE} height={MAP_SIZE} stroke="#2a3340" strokeWidth={2} />
    </Group>
  )
}

function DraftView({
  draft,
  color,
  strokeWidth,
  mapSize,
}: {
  draft: Draft
  color: string
  strokeWidth: number
  mapSize: number | null
}) {
  if (draft.type === 'arrow')
    return <Arrow points={draft.points} stroke={color} fill={color} strokeWidth={strokeWidth} pointerLength={14} pointerWidth={14} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
  if (draft.type === 'measure') {
    const [x1, y1, x2, y2] = draft.points
    const dist = Math.hypot(x2 - x1, y2 - y1)
    const m = mapSize ? Math.round((dist / MAP_SIZE) * mapSize) : Math.round(dist)
    return (
      <>
        <Arrow points={draft.points} stroke="#fde68a" fill="#fde68a" strokeWidth={strokeWidth} pointerLength={12} pointerWidth={12} dash={[8, 6]} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
        <Text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 - 18} text={`${m} m`} fontSize={14} fontStyle="bold" fill="#fde68a" />
      </>
    )
  }
  if (draft.type === 'line')
    return <Line points={draft.points} stroke={color} strokeWidth={strokeWidth} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
  if (draft.type === 'pen')
    return <Arrow points={draft.points} stroke={color} fill={color} strokeWidth={strokeWidth} pointerLength={Math.max(12, strokeWidth * 2.5)} pointerWidth={Math.max(12, strokeWidth * 2.5)} lineCap="round" lineJoin="round" tension={0.4} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
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

function ZoneDraft({ poly, color }: { poly: { pts: number[]; cx: number; cy: number }; color: string }) {
  const live = [...poly.pts, poly.cx, poly.cy]
  return (
    <>
      <Line points={live} stroke={color} strokeWidth={2} closed fill={color + '22'} dash={[6, 5]} perfectDrawEnabled={false} />
      {Array.from({ length: poly.pts.length / 2 }).map((_, i) => (
        <Circle key={i} x={poly.pts[i * 2]} y={poly.pts[i * 2 + 1]} radius={4} fill={i === 0 ? '#fff' : color} stroke="#0b0e13" strokeWidth={1} />
      ))}
    </>
  )
}

interface ElementViewProps {
  el: BoardElement
  selectable: boolean
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<BoardElement>, commit?: boolean) => void
}

const ElementView = memo(function ElementView({ el, selectable, onSelect, onChange }: ElementViewProps) {
  const common: CommonProps = {
    id: el.id,
    draggable: selectable,
    onMouseDown: (e) => {
      if (selectable) {
        e.cancelBubble = true
        onSelect(el.id)
      }
    },
  }
  const change = (patch: Partial<BoardElement>, commit?: boolean) => onChange(el.id, patch, commit)

  if (el.type === 'pen' || el.type === 'line' || el.type === 'arrow' || el.type === 'measure') {
    const poly = el as PolyElement
    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x()
      const dy = e.target.y()
      e.target.position({ x: 0, y: 0 })
      const shifted = poly.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      change({ points: shifted } as Partial<BoardElement>)
    }
    // arrow, measure and pen routes all carry a direction arrowhead; only `line` is plain.
    if (poly.type === 'arrow' || poly.type === 'measure' || poly.type === 'pen') {
      return (
        <>
          <Arrow
            {...common}
            points={poly.points}
            stroke={poly.color}
            fill={poly.color}
            strokeWidth={poly.strokeWidth}
            pointerLength={Math.max(12, poly.strokeWidth * 2.5)}
            pointerWidth={Math.max(12, poly.strokeWidth * 2.5)}
            tension={poly.type === 'pen' ? 0.4 : 0}
            dash={poly.type === 'measure' ? [8, 6] : undefined}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={18}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            onDragEnd={onDragEnd}
          />
          {poly.type === 'measure' && <MeasureLabel points={poly.points} />}
        </>
      )
    }
    return (
      <Line
        {...common}
        points={poly.points}
        stroke={poly.color}
        strokeWidth={poly.strokeWidth}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={18}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        onDragEnd={onDragEnd}
      />
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
        onDragEnd={(e) => change({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const sx = node.scaleX()
          const sy = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          change({ x: node.x(), y: node.y(), width: Math.max(8, el.width * sx), height: Math.max(8, el.height * sy), rotation: node.rotation() } as Partial<BoardElement>)
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
        onDragEnd={(e) => change({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const s = node.scaleX()
          node.scaleX(1)
          node.scaleY(1)
          change({ x: node.x(), y: node.y(), radius: Math.max(6, el.radius * s) } as Partial<BoardElement>)
        }}
      />
    )
  }

  if (el.type === 'zone') {
    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x()
      const dy = e.target.y()
      e.target.position({ x: 0, y: 0 })
      const shifted = el.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      change({ points: shifted } as Partial<BoardElement>)
    }
    const xs = el.points.filter((_, i) => i % 2 === 0)
    const ys = el.points.filter((_, i) => i % 2 === 1)
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length
    return (
      <>
        <Line
          {...common}
          points={el.points}
          closed
          stroke={el.color}
          strokeWidth={2.5}
          fill={el.color + '2e'}
          hitStrokeWidth={12}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
          onDragEnd={onDragEnd}
        />
        {el.label && (
          <Text text={el.label} fontSize={15} fontStyle="bold" fill="#fff" stroke="#000" strokeWidth={0.7} align="center" width={80} offsetX={40} x={cx} y={cy - 8} listening={false} />
        )}
      </>
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
          const t = window.prompt('Text:', el.text)
          if (t != null) change({ text: t } as Partial<BoardElement>)
        }}
        onDragEnd={(e) => change({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)}
        onTransformEnd={(e) => {
          const node = e.target
          const s = node.scaleX()
          node.scaleX(1)
          node.scaleY(1)
          change({ x: node.x(), y: node.y(), fontSize: Math.max(8, el.fontSize * s), rotation: node.rotation() } as Partial<BoardElement>)
        }}
      />
    )
  }

  return <IconView el={el as IconElement} common={common} change={change} />
})

function MeasureLabel({ points }: { points: number[] }) {
  const [x1, y1, x2, y2] = points
  const dist = Math.hypot(x2 - x1, y2 - y1)
  const { mapId } = useBoardStore.getState()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const m = map ? Math.round((dist / MAP_SIZE) * map.sizeMeters) : Math.round(dist)
  return <Text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 - 18} text={`${m} m`} fontSize={14} fontStyle="bold" fill="#fde68a" listening={false} />
}

function IconView({
  el,
  common,
  change,
}: {
  el: IconElement
  common: CommonProps
  change: (patch: Partial<BoardElement>, commit?: boolean) => void
}) {
  const asset = ASSET_BY_ID[el.assetId]
  // Always tint the blue base variant to the element color (team / squad / custom).
  const url = asset?.icon ? `/icons/blue/${asset.icon}.svg` : null
  const img = useTintedIcon(url, el.color)

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) =>
    change({ x: e.target.x(), y: e.target.y() } as Partial<BoardElement>)
  const onTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    const s = node.scaleX()
    node.scaleX(1)
    node.scaleY(1)
    change({ x: node.x(), y: node.y(), scale: Math.max(0.4, el.scale * s), rotation: node.rotation() } as Partial<BoardElement>)
  }

  const groupProps = {
    ...common,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scale,
    scaleY: el.scale,
    onDragEnd,
    onTransformEnd,
  }

  // Real in-game SVG icon
  if (url && img) {
    const S = 44
    return (
      <Group {...groupProps}>
        {/* squad-color ring when the marker belongs to a specific squad */}
        {el.rosterSquadId && <Circle radius={S / 2 + 2} stroke={el.color} strokeWidth={3} shadowColor="#000" shadowBlur={3} shadowOpacity={0.6} />}
        <KonvaImage image={img} width={S} height={S} offsetX={S / 2} offsetY={S / 2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />
        {el.label && <Text text={el.label} fontSize={13} fontStyle="bold" fill="#fff" stroke="#000" strokeWidth={0.6} align="center" width={140} offsetX={70} y={S / 2} listening={false} />}
      </Group>
    )
  }

  // Fallback: colored badge + glyph (order markers / icon still loading)
  const fill = el.color
  const R = 18
  const shape = asset?.shape ?? 'circle'
  return (
    <Group {...groupProps}>
      {shape === 'circle' && <Circle radius={R} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'square' && <Rect width={R * 2} height={R * 2} offsetX={R} offsetY={R} cornerRadius={4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'diamond' && <RegularPolygon sides={4} radius={R + 4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      <Text text={asset?.glyph ?? '?'} fontSize={20} align="center" verticalAlign="middle" width={R * 2} height={R * 2} offsetX={R} offsetY={R} listening={false} />
      {el.label && <Text text={el.label} fontSize={13} fontStyle="bold" fill="#fff" stroke="#000" strokeWidth={0.6} align="center" width={140} offsetX={70} y={R + 3} listening={false} />}
    </Group>
  )
}
