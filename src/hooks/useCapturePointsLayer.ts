import { useEffect, useState } from 'react'
import { getCapturePointsSync, loadCapturePoints } from '../lib/capturePoints'
import type { CapturePoint } from '../types'

/** Lazy-load capture point overlay data for a map layer. */
export function useCapturePointsLayer(layerId: string | null): CapturePoint[] {
  const [points, setPoints] = useState<CapturePoint[]>(() =>
    layerId ? getCapturePointsSync(layerId) ?? [] : [],
  )

  useEffect(() => {
    if (!layerId) {
      setPoints([])
      return
    }
    const cached = getCapturePointsSync(layerId)
    if (cached) {
      setPoints(cached)
      return
    }
    let cancelled = false
    loadCapturePoints().then(() => {
      if (!cancelled) setPoints(getCapturePointsSync(layerId) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [layerId])

  return points
}
