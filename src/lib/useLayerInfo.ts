import { useEffect, useState } from 'react'

// Compact real layer data (factions, tickets, commander, vehicle inventory with
// spawn/respawn timings), generated from the SquadMaps dataset into
// /public/layer-info.json and fetched lazily on first use.

export interface LayerVehicle {
  /** Vehicle type name, e.g. "KamAZ 5350 Logistics". */
  n: string
  /** Count available. */
  q: number
  /** Initial spawn delay in minutes. */
  d: number
  /** Respawn time in minutes. */
  r: number
  /** SquadMaps icon key, e.g. "map_truck_logistics". */
  i: string
}

export interface LayerTeam {
  /** Short faction code, e.g. "USA". */
  f: string
  /** Ticket count. */
  t: string
  /** Has a commander slot. */
  c: boolean
  v: LayerVehicle[]
}

export interface LayerInfoData {
  t1?: LayerTeam
  t2?: LayerTeam
}

let cache: Promise<Record<string, LayerInfoData>> | null = null
function loadAll(): Promise<Record<string, LayerInfoData>> {
  if (!cache) cache = fetch('/layer-info.json').then((r) => r.json()).catch(() => ({}))
  return cache
}

export function useLayerInfo(layerId: string | null): LayerInfoData | null {
  const [data, setData] = useState<LayerInfoData | null>(null)
  useEffect(() => {
    if (!layerId) {
      setData(null)
      return
    }
    let active = true
    loadAll().then((all) => {
      if (active) setData(all[layerId] ?? null)
    })
    return () => {
      active = false
    }
  }, [layerId])
  return data
}

/** Map a SquadMaps vehicle icon key to a local asset id (for the assignment glyph). */
export function assetIdForIcon(icon: string): string {
  if (icon.includes('truck_logistics') || icon.includes('logi')) return 'logi'
  if (icon.includes('truck_transport') || icon.includes('truck')) return 'transport'
  if (icon.includes('attackhelo') || icon.includes('cas')) return 'cas_heli'
  if (icon.includes('jeep_antitank')) return 'heli_atk'
  if (icon.includes('transporthelo') || icon.includes('helo')) return 'heli_trans'
  if (icon.includes('boat')) return 'boat'
  if (icon.includes('tank')) return 'mbt'
  if (icon.includes('ifv')) return 'ifv'
  if (icon.includes('apc')) return 'apc'
  if (icon.includes('jeep') || icon.includes('recon') || icon.includes('motorcycle')) return 'mrap'
  if (icon.includes('antiair') || icon.includes('AntiAir')) return 'helipad'
  return 'transport'
}

/** Human-readable timing string from spawn delay + respawn minutes. */
export function timingLabel(delay: number, respawn: number): string {
  const spawn = delay > 0 ? `+${delay}m` : '0:00'
  return respawn > 0 ? `${spawn} · resp ${respawn}m` : spawn
}
