import type { CapturePoint } from '../types'

let cache: Record<string, CapturePoint[]> | null = null
let loadPromise: Promise<Record<string, CapturePoint[]>> | null = null

export function loadCapturePoints(): Promise<Record<string, CapturePoint[]>> {
  if (cache) return Promise.resolve(cache)
  if (loadPromise) return loadPromise
  loadPromise = fetch(`${import.meta.env.BASE_URL}capture-points.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      cache = data as Record<string, CapturePoint[]>
      return cache
    })
    .catch(() => {
      cache = {}
      return cache
    })
  return loadPromise
}

export function getCapturePointsSync(layerId: string | null): CapturePoint[] | undefined {
  if (!layerId || !cache) return undefined
  return cache[layerId]
}
