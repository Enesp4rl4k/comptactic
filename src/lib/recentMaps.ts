const KEY = 'comptactic:recent-maps'
const MAX = 3

export interface RecentLayer {
  mapId: string
  layerId: string
  label: string
}

export function loadRecentMaps(): RecentLayer[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? (JSON.parse(raw) as RecentLayer[]) : []
    return Array.isArray(arr) ? arr.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberLayer(mapId: string, layerId: string, label: string) {
  const next = [{ mapId, layerId, label }, ...loadRecentMaps().filter((r) => r.layerId !== layerId)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
