import type { CapturePoint } from '../types'

const KEY = 'comptactic:cp-overlay'

export interface CpOverlayPrefs {
  show: boolean
  hideMains: boolean
}

const DEFAULT: CpOverlayPrefs = { show: true, hideMains: true }

export function loadCpOverlayPrefs(): CpOverlayPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const p = JSON.parse(raw) as Partial<CpOverlayPrefs>
    return {
      show: p.show ?? DEFAULT.show,
      hideMains: p.hideMains ?? DEFAULT.hideMains,
    }
  } catch {
    return DEFAULT
  }
}

export function saveCpOverlayPrefs(prefs: CpOverlayPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function isMainCapturePoint(cp: CapturePoint): boolean {
  const hay = `${cp.id} ${cp.name}`.toLowerCase()
  return hay.includes('main') || /team\s*[12]/.test(hay) || /^100-/.test(cp.id)
}

/** Filter and re-number capture points for display (AAS order preserved). */
export function filterCapturePoints(points: CapturePoint[], prefs: CpOverlayPrefs): CapturePoint[] {
  if (!prefs.show) return []
  return prefs.hideMains ? points.filter((p) => !isMainCapturePoint(p)) : [...points]
}
