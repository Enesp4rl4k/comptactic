import Konva from 'konva'
import type { BoardSnapshot } from '../types'

const LS_KEY = 'squad-tactics:autosave'

export function saveLocal(snap: BoardSnapshot) {
  localStorage.setItem(LS_KEY, JSON.stringify(snap))
}

export function loadLocal(): BoardSnapshot | null {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as BoardSnapshot
  } catch {
    return null
  }
}

export function clearLocal() {
  localStorage.removeItem(LS_KEY)
}

export function downloadJSON(snap: BoardSnapshot) {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `squad-tactic-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(): Promise<BoardSnapshot | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result)) as BoardSnapshot)
        } catch {
          resolve(null)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

// --- shareable link: encode snapshot into URL hash (no backend until Phase 5) ---

export function encodeToHash(snap: BoardSnapshot): string {
  const json = JSON.stringify(snap)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `${location.origin}${location.pathname}#plan=${b64}`
}

export function decodeFromHash(): BoardSnapshot | null {
  const m = location.hash.match(/plan=([^&]+)/)
  if (!m) return null
  try {
    const json = decodeURIComponent(escape(atob(m[1])))
    return JSON.parse(json) as BoardSnapshot
  } catch {
    return null
  }
}

// --- PNG export from the Konva stage ---

export function exportPNG() {
  // Pick the stage that is actually visible (board view vs. tactic sheet may both
  // have mounted a stage); fall back to the first one.
  const stage =
    Konva.stages.find((s) => {
      const c = s.container()
      return c && c.offsetParent !== null
    }) ?? Konva.stages[0]
  if (!stage) return
  const tr = stage.find('Transformer')
  tr.forEach((t) => t.hide())
  const uri = stage.toDataURL({ pixelRatio: 2 })
  tr.forEach((t) => t.show())
  const a = document.createElement('a')
  a.href = uri
  a.download = `squad-tactic-${Date.now()}.png`
  a.click()
}
