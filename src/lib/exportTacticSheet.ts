import { captureStageURI } from './exportSlides'
import { useBoardStore } from '../store/useBoardStore'
import { MAP_BY_ID } from '../data/maps'
import { ROLE_BY_ID } from '../data/roles'

const SHEET_W = 1920
const SHEET_H = 1080
const MAP_W = Math.floor(SHEET_W * 0.68)
const ROSTER_X = MAP_W + 24

/** Composite PNG: map (left) + line-up + layer title (right). */
export async function exportTacticSheetPNG(): Promise<boolean> {
  const mapUri = captureStageURI(2)
  if (!mapUri) return false

  const { mapId, layerId, customImageName, squads, slides, activeSlideId } = useBoardStore.getState()
  const map = mapId ? MAP_BY_ID[mapId] : null
  const layer = map?.layers.find((l) => l.id === layerId) ?? null
  const slide = slides.find((s) => s.id === activeSlideId)

  const canvas = document.createElement('canvas')
  canvas.width = SHEET_W
  canvas.height = SHEET_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  ctx.fillStyle = '#0b0e13'
  ctx.fillRect(0, 0, SHEET_W, SHEET_H)

  const mapImg = await loadImage(mapUri)
  const mapH = SHEET_H - 48
  const scale = Math.min(MAP_W / mapImg.width, mapH / mapImg.height)
  const dw = mapImg.width * scale
  const dh = mapImg.height * scale
  const dx = (MAP_W - dw) / 2
  const dy = 24 + (mapH - dh) / 2
  ctx.drawImage(mapImg, dx, dy, dw, dh)

  ctx.fillStyle = '#e5e7eb'
  ctx.font = 'bold 28px system-ui, sans-serif'
  const title = layer?.name ?? customImageName ?? 'Tactic'
  ctx.fillText(title, ROSTER_X, 40)

  ctx.font = '14px system-ui, sans-serif'
  ctx.fillStyle = '#9ca3af'
  let sub = map?.name ?? 'Custom map'
  if (layer && map) {
    sub = `${map.name} · ${layer.mode} · ${layer.factions[0]} vs ${layer.factions[1]}`
  }
  ctx.fillText(sub, ROSTER_X, 68)
  if (slide?.name) ctx.fillText(`Slide: ${slide.name}`, ROSTER_X, 88)

  ctx.fillStyle = '#6b7280'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText('LINE-UP', ROSTER_X, 118)

  let y = 138
  const colW = SHEET_W - ROSTER_X - 24
  for (let i = 0; i < squads.length; i++) {
    const sq = squads[i]
    if (y > SHEET_H - 60) break
    ctx.fillStyle = sq.color
    ctx.fillRect(ROSTER_X, y, 4, 52)
    ctx.fillStyle = '#f3f4f6'
    ctx.font = 'bold 15px system-ui, sans-serif'
    ctx.fillText(sq.name, ROSTER_X + 12, y + 18)
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText(`S${i + 1}`, ROSTER_X + colW - 28, y + 16)

    let my = y + 32
    for (const m of sq.members) {
      if (!m.name.trim() && !m.role) continue
      if (my > y + 50) break
      const role = ROLE_BY_ID[m.role]?.short ?? m.role
      ctx.fillStyle = '#6b7280'
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillText(role, ROSTER_X + 12, my)
      ctx.fillStyle = '#d1d5db'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText(m.name || '—', ROSTER_X + 48, my)
      my += 16
    }
    y += 62
  }

  if (!squads.length) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('No squads', ROSTER_X, 150)
  }

  const uri = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = uri
  a.download = `comptactic-sheet-${Date.now()}.png`
  a.click()
  return true
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
