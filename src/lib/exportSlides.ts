import jsPDF from 'jspdf'
import Konva from 'konva'
import { useBoardStore } from '../store/useBoardStore'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function visibleStage(): Konva.Stage | null {
  return (
    Konva.stages.find((s) => {
      const c = s.container()
      return c && c.offsetParent !== null
    }) ??
    Konva.stages[0] ??
    null
  )
}

/** Capture the currently visible Konva stage as a PNG data URL (transformer hidden). */
export function captureStageURI(pixelRatio = 2): string | null {
  const stage = visibleStage()
  if (!stage) return null
  const tr = stage.find('Transformer')
  tr.forEach((t) => t.hide())
  const uri = stage.toDataURL({ pixelRatio })
  tr.forEach((t) => t.show())
  return uri
}

function imageSize(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src = uri
  })
}

interface Shot {
  name: string
  uri: string
  w: number
  h: number
}

/** Steps through every slide, capturing the board, then restores the original slide. */
async function captureAllSlides(): Promise<Shot[]> {
  const st = useBoardStore.getState()
  const slides = st.slides
  const original = st.activeSlideId
  const shots: Shot[] = []
  for (const sl of slides) {
    st.setActiveSlide(sl.id)
    await wait(180) // let React + Konva paint the new slide
    const uri = captureStageURI()
    if (uri) {
      const { w, h } = await imageSize(uri)
      shots.push({ name: sl.name, uri, w, h })
    }
  }
  st.setActiveSlide(original)
  await wait(40)
  return shots
}

/** Export all slides as a multi-page PDF (one slide per page, landscape). */
export async function exportSlidesPDF(): Promise<boolean> {
  const shots = await captureAllSlides()
  if (!shots.length) return false
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const margin = 24
  const headerH = 22
  shots.forEach((s, i) => {
    if (i > 0) pdf.addPage()
    pdf.setFontSize(13)
    pdf.setTextColor(20)
    pdf.text(`${i + 1}. ${s.name}`, margin, margin)
    const availW = pw - margin * 2
    const availH = ph - margin * 2 - headerH
    const scale = Math.min(availW / s.w, availH / s.h)
    const w = s.w * scale
    const h = s.h * scale
    pdf.addImage(s.uri, 'PNG', (pw - w) / 2, margin + headerH, w, h)
  })
  pdf.save(`comptactic-briefing-${Date.now()}.pdf`)
  return true
}

/** Export all slides stacked into one tall PNG (single download, no extra files). */
export async function exportSlidesPNG(): Promise<boolean> {
  const shots = await captureAllSlides()
  if (!shots.length) return false
  const pad = 24
  const labelH = 34
  const width = Math.max(...shots.map((s) => s.w)) + pad * 2
  const totalH = shots.reduce((acc, s) => acc + s.h + labelH + pad, pad)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = totalH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0c0c0d'
  ctx.fillRect(0, 0, width, totalH)

  let y = pad
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]
    ctx.fillStyle = '#e5e7eb'
    ctx.font = 'bold 20px Inter, sans-serif'
    ctx.fillText(`${i + 1}. ${s.name}`, pad, y + 22)
    y += labelH
    const img = await loadImage(s.uri)
    ctx.drawImage(img, pad, y, s.w, s.h)
    y += s.h + pad
  }

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `comptactic-slides-${Date.now()}.png`
  a.click()
  return true
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = uri
  })
}
