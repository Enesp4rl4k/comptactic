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
import { usePresence } from '../lib/presence'
import { useImage } from '../lib/useImage'
import { useTintedIcon } from '../lib/useTintedIcon'
import { canUploadImage, uploadPlanImage } from '../lib/storage'
import { simplifyPoints } from '../lib/simplify'
import { MAP_BY_ID } from '../data/maps'
import { ASSET_BY_ID } from '../data/assets'
import type { BoardElement, IconElement, PolyElement, ToolId } from '../types'

export const MAP_SIZE = 1024
const PEN_MIN_DIST = 3 // stage units between captured freehand points
const GRID_STEP = MAP_SIZE / 32 // snap-to-grid increment
const snapVal = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP

/** Commit a drag of an x/y element: applies snap + moves the rest of the selection. */
function commitXYDrag(node: Konva.Node, el: { id: string; x: number; y: number }, change: (p: Partial<BoardElement>) => void) {
  const st = useBoardStore.getState()
  let nx = node.x()
  let ny = node.y()
  if (st.snapToGrid) {
    nx = snapVal(nx)
    ny = snapVal(ny)
    node.position({ x: nx, y: ny })
  }
  change({ x: nx, y: ny } as Partial<BoardElement>)
  if (st.selectedIds.length > 1 && st.selectedIds.includes(el.id)) st.moveSelectionBy(nx - el.x, ny - el.y, el.id)
}

/** Commit a drag of a points-based element: applies snap + moves the rest of the selection. */
function commitPointsDrag(node: Konva.Node, el: { id: string }, points: number[], change: (p: Partial<BoardElement>) => void) {
  const st = useBoardStore.getState()
  let dx = node.x()
  let dy = node.y()
  if (st.snapToGrid) {
    dx = snapVal(dx)
    dy = snapVal(dy)
  }
  node.position({ x: 0, y: 0 })
  change({ points: points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy)) } as Partial<BoardElement>)
  if (st.selectedIds.length > 1 && st.selectedIds.includes(el.id)) st.moveSelectionBy(dx, dy, el.id)
}

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
  // id of the most recent freehand stroke, to allow continuing it
  const lastPenIdRef = useRef<string | null>(null)
  // active right-button pan session
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  // throttle outgoing presence cursor updates
  const lastCursorRef = useRef(0)

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
  const copySelection = useBoardStore((s) => s.copySelection)
  const paste = useBoardStore((s) => s.paste)
  const duplicateSelection = useBoardStore((s) => s.duplicateSelection)
  const toggleSelection = useBoardStore((s) => s.toggleSelection)

  const placingAssetId = useBoardStore((s) => s.placingAssetId)
  const customImage = useBoardStore((s) => s.customImage)
  const setCustomImage = useBoardStore((s) => s.setCustomImage)
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null
  const [bg, bgStatus] = useImage(customImage ?? layer?.image ?? null)
  const hasBg = Boolean(customImage || layer)

  // stable callbacks for memoized elements
  const handleSelect = useCallback(
    (id: string, additive = false) => {
      if (additive) {
        toggleSelection(id)
        return
      }
      // Clicking an element that's already part of a multi-selection keeps the
      // group (so it can be dragged together); otherwise select just this one.
      if (!useBoardStore.getState().selectedIds.includes(id)) setSelection([id])
    },
    [setSelection, toggleSelection],
  )
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
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedIds.length) {
          e.preventDefault()
          copySelection()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        paste()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedIds.length) {
          e.preventDefault()
          duplicateSelection()
        }
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
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // single-key tool shortcuts
        const TOOL_KEYS: Record<string, ToolId> = {
          v: 'select', a: 'arrow', l: 'line', p: 'pen', r: 'rect',
          c: 'circle', z: 'zone', t: 'text', m: 'measure', g: 'ping',
        }
        const next = TOOL_KEYS[e.key.toLowerCase()]
        if (next) {
          e.preventDefault()
          setTool(next)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, undo, redo, removeElements, setSelection, setTool, copySelection, paste, duplicateSelection])

  // Paste an image (Ctrl+V) to use it as a custom board background.
  useEffect(() => {
    if (readOnly) return
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const loadLocalImage = () => {
        const reader = new FileReader()
        reader.onload = () => setCustomImage(reader.result as string, 'Pasted image')
        reader.readAsDataURL(file)
      }
      canUploadImage().then((ok) => {
        if (ok) uploadPlanImage(file).then((url) => setCustomImage(url, 'Pasted image')).catch(loadLocalImage)
        else loadLocalImage()
      })
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
    if (selectedIds.length) {
      const nodes = selectedIds.map((id) => stage.findOne('#' + id)).filter(Boolean) as Konva.Node[]
      tr.nodes(nodes)
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
      rosterSquadId: sq?.id,
    }
  }

  const finalizeZone = (pts: number[]) => {
    if (pts.length < 6) {
      setPoly(null)
      return
    }
    const { color: c, rosterSquadId } = effDraw()
    addElement({ type: 'zone', points: pts, team, color: c, rotation: 0, rosterSquadId } as Omit<BoardElement, 'id' | 'z'>)
    setPoly(null)
  }

  // Right mouse button pans the map regardless of the active tool, so you can
  // draw with the left button and reposition the map with the right.
  const startPan = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault()
    panRef.current = { sx: e.evt.clientX, sy: e.evt.clientY, vx: view.x, vy: view.y }
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
    const move = (ev: MouseEvent) => {
      const p = panRef.current
      if (!p) return
      setView((v) => ({ ...v, x: p.vx + (ev.clientX - p.sx), y: p.vy + (ev.clientY - p.sy) }))
    }
    const up = () => {
      panRef.current = null
      if (containerRef.current) containerRef.current.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      startPan(e)
      return
    }
    if (e.evt.button !== 0) return // ignore middle button
    if (readOnly) return
    // Ping: flash an expanding ring for everyone (no permanent mark), stays armed.
    if (tool === 'ping') {
      const p = relPointer()
      usePresence.getState().sendPing(p.x, p.y)
      return
    }
    // Click-to-place: an armed palette asset drops at the cursor and stays armed
    // so multiple can be placed; right-click/Escape/select tool cancels it.
    if (placingAssetId) {
      placeAsset(placingAssetId, relPointer())
      return
    }
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
      if (text) {
        const eff = effDraw()
        addElement({ type: 'text', x: p.x, y: p.y, text, fontSize: 22, team, color: eff.color, rotation: 0, rosterSquadId: eff.rosterSquadId } as Omit<BoardElement, 'id' | 'z'>)
      }
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

  const onMouseMove = (e?: Konva.KonvaEventObject<MouseEvent>) => {
    if (!readOnly) {
      const now = Date.now()
      if (now - lastCursorRef.current > 45) {
        lastCursorRef.current = now
        const p = relPointer()
        usePresence.getState().setCursor(p.x, p.y)
      }
    }
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
      // Hold Shift to constrain straight tools to 45° angle increments.
      let end = { x: p.x, y: p.y }
      if (e?.evt.shiftKey && (draft.type === 'line' || draft.type === 'arrow' || draft.type === 'measure')) {
        const x1 = draft.points[0]
        const y1 = draft.points[1]
        const dist = Math.hypot(p.x - x1, p.y - y1)
        const step = Math.PI / 4
        const ang = Math.round(Math.atan2(p.y - y1, p.x - x1) / step) * step
        end = { x: x1 + Math.cos(ang) * dist, y: y1 + Math.sin(ang) * dist }
      }
      setDraft((d) => (d ? { ...d, points: [d.points[0], d.points[1], end.x, end.y] } : d))
    }
  }

  const onMouseUp = () => {
    if (!draft) return
    const d = draft
    setDraft(null)
    lastPenRef.current = null
    // measurement keeps its own styling; everything else adopts the squad color + link
    const eff = effDraw()
    const drawColor = d.type === 'measure' ? color : eff.color
    const squadId = d.type === 'measure' ? undefined : eff.rosterSquadId
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
        rosterSquadId: squadId,
      } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'circle') {
      const [x1, y1, x2, y2] = d.points
      const r = Math.hypot(x2 - x1, y2 - y1)
      if (r < 4) return
      addElement({ type: 'circle', x: x1, y: y1, radius: r, team, color: drawColor, rotation: 0, rosterSquadId: squadId } as Omit<BoardElement, 'id' | 'z'>)
    } else if (d.type === 'pen') {
      if (d.points.length < 4) return
      const pts = simplifyPoints(d.points, 2)
      // Continue the previous freehand if this stroke starts near its end point.
      const prev = lastPenIdRef.current ? (useBoardStore.getState().elements[lastPenIdRef.current] as PolyElement | undefined) : undefined
      if (prev && prev.type === 'pen') {
        const ex = prev.points[prev.points.length - 2]
        const ey = prev.points[prev.points.length - 1]
        if (Math.hypot(pts[0] - ex, pts[1] - ey) < 28) {
          updateElement(lastPenIdRef.current!, { points: [...prev.points, ...pts.slice(2)] } as Partial<BoardElement>, true)
          setSelection([lastPenIdRef.current!])
          return
        }
      }
      lastPenIdRef.current = addElement({ type: 'pen', points: pts, strokeWidth, team, color: drawColor, rotation: 0, rosterSquadId: squadId } as Omit<BoardElement, 'id' | 'z'>)
    } else {
      const moved = Math.hypot(d.points[2] - d.points[0], d.points[3] - d.points[1])
      if (moved < 4) return
      addElement({ type: d.type, points: d.points, strokeWidth, team, color: drawColor, rotation: 0, rosterSquadId: squadId } as Omit<BoardElement, 'id' | 'z'>)
    }
  }

  // Place an asset icon at a stage point (squad-aware coloring + label).
  const placeAsset = (assetId: string, p: { x: number; y: number }) => {
    const asset = ASSET_BY_ID[assetId]
    const st = useBoardStore.getState()
    const activeSquad = st.squads.find((s) => s.id === st.activeSquadId) ?? null

    let iconColor: string
    let rosterSquadId: string | undefined
    if (activeSquad) {
      iconColor = activeSquad.color
      rosterSquadId = activeSquad.id
    } else {
      iconColor = asset?.teamColored ? st.color : asset?.fixedColor ?? st.color
    }

    addElement({
      type: 'icon',
      x: p.x,
      y: p.y,
      assetId,
      scale: st.placeScale,
      team: st.team,
      color: iconColor,
      rotation: 0,
      rosterSquadId,
    } as Omit<BoardElement, 'id' | 'z'>)
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
    placeAsset(assetId, p)
  }

  const ordered = useMemo(() => Object.values(elements).sort((a, b) => a.z - b.z), [elements])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-bg"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
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
        draggable={readOnly ? true : tool === 'select' && !draft && !placingAssetId}
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
        style={{ cursor: readOnly ? 'grab' : placingAssetId ? 'copy' : isDrawingTool ? 'crosshair' : 'default' }}
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
          {ordered
            .filter((el) => !el.hidden)
            .map((el) => (
              <ElementView key={el.id} el={el} selectable={!readOnly && tool === 'select' && !el.locked} onSelect={handleSelect} onChange={handleChange} />
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

        {/* live collaborators' cursors */}
        {!readOnly && (
          <Layer listening={false}>
            <PeerCursors scale={view.scale} />
          </Layer>
        )}

        {/* transient pings (visible to everyone, including briefing viewers) */}
        <Layer listening={false}>
          <PingLayer scale={view.scale} />
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

/** Contextual editor for the single selected element: color + size. */
function SelectionBar() {
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const elements = useBoardStore((s) => s.elements)
  const updateElement = useBoardStore((s) => s.updateElement)
  const beginHistory = useBoardStore((s) => s.beginHistory)
  const palette = useBoardStore((s) => s.palette)
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
        {palette.map((c) => (
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
        className="w-28 accent-neutral-400"
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
  onSelect: (id: string, additive?: boolean) => void
  onChange: (id: string, patch: Partial<BoardElement>, commit?: boolean) => void
}

const ElementView = memo(function ElementView({ el, selectable, onSelect, onChange }: ElementViewProps) {
  const common: CommonProps = {
    id: el.id,
    draggable: selectable,
    onMouseDown: (e) => {
      if (selectable) {
        e.cancelBubble = true
        onSelect(el.id, e.evt.shiftKey)
      }
    },
  }
  const change = (patch: Partial<BoardElement>, commit?: boolean) => onChange(el.id, patch, commit)

  if (el.type === 'pen' || el.type === 'line' || el.type === 'arrow' || el.type === 'measure') {
    const poly = el as PolyElement
    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => commitPointsDrag(e.target, poly, poly.points, change)
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
        onDragEnd={(e) => commitXYDrag(e.target, el, change)}
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
        onDragEnd={(e) => commitXYDrag(e.target, el, change)}
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
    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => commitPointsDrag(e.target, el, el.points, change)
    return (
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
        onDragEnd={(e) => commitXYDrag(e.target, el, change)}
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

  // FOB radio shows its in-game 150 m / 300 m radius rings on hover.
  const [hover, setHover] = useState(false)
  const mapId = useBoardStore((s) => s.mapId)
  const sizeMeters = mapId ? MAP_BY_ID[mapId]?.sizeMeters ?? null : null
  const showRings = el.assetId === 'fob' && hover && !!sizeMeters
  const metersToStage = sizeMeters ? MAP_SIZE / sizeMeters : 0

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => commitXYDrag(e.target, el, change)
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
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  }

  // Real in-game SVG icon
  if (url && img) {
    const S = 44
    return (
      <Group {...groupProps}>
        {showRings && <RadioRings metersToStage={metersToStage} scale={el.scale} color={el.color} />}
        <KonvaImage image={img} width={S} height={S} offsetX={S / 2} offsetY={S / 2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />
      </Group>
    )
  }

  // Fallback: colored badge + glyph (order markers / icon still loading)
  const fill = el.color
  const R = 18
  const shape = asset?.shape ?? 'circle'
  return (
    <Group {...groupProps}>
      {showRings && <RadioRings metersToStage={metersToStage} scale={el.scale} color={el.color} />}
      {shape === 'circle' && <Circle radius={R} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'square' && <Rect width={R * 2} height={R * 2} offsetX={R} offsetY={R} cornerRadius={4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      {shape === 'diamond' && <RegularPolygon sides={4} radius={R + 4} fill={fill} stroke="#0b0e13" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.5} />}
      <Text text={asset?.glyph ?? '?'} fontSize={20} align="center" verticalAlign="middle" width={R * 2} height={R * 2} offsetX={R} offsetY={R} listening={false} />
    </Group>
  )
}

// Live cursors of other people in the same room (stage coordinates).
function PeerCursors({ scale }: { scale: number }) {
  const peers = usePresence((s) => s.peers)
  const s = 1 / scale // keep cursors a constant on-screen size regardless of zoom
  return (
    <>
      {Object.values(peers)
        .filter((p) => p.x != null && p.y != null)
        .map((p) => (
          <Group key={p.id} x={p.x as number} y={p.y as number} listening={false}>
            <Line points={[0, 0, 0, 18 * s, 5 * s, 13 * s, 12 * s, 20 * s, 15 * s, 17 * s, 8 * s, 11 * s, 14 * s, 11 * s]} closed fill={p.color} stroke="#0b0e13" strokeWidth={1 * s} />
            <Rect x={14 * s} y={16 * s} width={(p.name.length * 7 + 12) * s} height={18 * s} cornerRadius={4 * s} fill={p.color} />
            <Text x={20 * s} y={20 * s} text={p.name} fontSize={11 * s} fontStyle="bold" fill="#0b0e13" />
          </Group>
        ))}
    </>
  )
}

// Transient "ping" rings: a couple of circles that expand and fade out, used to
// point at the map while explaining. Driven by a RAF tick while pings exist.
const PING_MS = 1100
function PingLayer({ scale }: { scale: number }) {
  const pings = usePresence((s) => s.pings)
  const [, force] = useState(0)
  useEffect(() => {
    if (!pings.length) return
    let raf = 0
    const tick = () => {
      force((n) => n + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pings.length])

  const now = Date.now()
  const s = 1 / scale // keep ping size constant on screen regardless of zoom
  return (
    <>
      {pings.map((p) => {
        const age = now - p.t
        if (age < 0 || age > PING_MS) return null
        return (
          <Group key={p.id} x={p.x} y={p.y} listening={false}>
            {[0, 0.33].map((delay, i) => {
              const prog = Math.min(1, Math.max(0, age / PING_MS - delay))
              if (prog <= 0 || prog >= 1) return null
              return (
                <Circle
                  key={i}
                  radius={(8 + prog * 34) * s}
                  stroke={p.color}
                  strokeWidth={(3 - prog * 2) * s}
                  opacity={1 - prog}
                  listening={false}
                />
              )
            })}
            <Circle radius={5 * s} fill={p.color} opacity={Math.max(0, 1 - age / PING_MS)} listening={false} />
          </Group>
        )
      })}
    </>
  )
}

// FOB radio coverage rings (150 m + 300 m), drawn in the radio's own color.
// Sizes divide by the icon scale so the rings stay at true map-metre radius.
function RadioRings({ metersToStage, scale, color }: { metersToStage: number; scale: number; color: string }) {
  const r150 = (150 * metersToStage) / scale
  const r300 = (300 * metersToStage) / scale
  const sw = 1.5 / scale
  const dash = [6 / scale, 5 / scale]
  return (
    <>
      <Circle radius={r300} stroke={color} strokeWidth={sw} dash={dash} fill={color + '0d'} listening={false} />
      <Circle radius={r150} stroke={color} strokeWidth={sw * 1.4} fill={color + '14'} listening={false} />
      <Text text="150m" x={4 / scale} y={-r150 - 14 / scale} fontSize={11 / scale} fontStyle="bold" fill={color} listening={false} />
      <Text text="300m" x={4 / scale} y={-r300 - 14 / scale} fontSize={11 / scale} fontStyle="bold" fill={color} listening={false} />
    </>
  )
}
