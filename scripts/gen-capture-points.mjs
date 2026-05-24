/**
 * Build public/capture-points.json from Squad Wiki pipeline map data.
 * Source: https://github.com/Squad-Wiki/squad-wiki-pipeline-map-data (CC BY-SA 4.0)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MAPS_TS = join(ROOT, 'src/data/maps.ts')
const OUT = join(ROOT, 'public/capture-points.json')
const WIKI_URL =
  'https://raw.githubusercontent.com/Squad-Wiki/squad-wiki-pipeline-map-data/master/completed_output/_Current%20Version/finished.json'

const ALLOWED_MODES = new Set(['AAS', 'Skirmish'])

function norm(s) {
  return s.replace(/\s+/g, '').toLowerCase()
}

function findObjectiveKey(objectives, pointName) {
  const target = norm(pointName)
  for (const k of Object.keys(objectives)) {
    if (norm(k) === target) return k
  }
  const prefix = pointName.split('-')[0]?.toLowerCase()
  if (!prefix) return null
  for (const k of Object.keys(objectives)) {
    if (k.toLowerCase().startsWith(prefix)) return k
  }
  return null
}

function worldToNorm(x, y, corners) {
  if (!corners?.length || corners.length < 2) return null
  const minX = corners[0].location_x
  const minY = corners[0].location_y
  const maxX = corners[1].location_x
  const maxY = corners[1].location_y
  const w = maxX - minX
  const h = maxY - minY
  if (!w || !h) return null
  const nx = (x - minX) / w
  const ny = 1 - (y - minY) / h
  return {
    x: Math.max(0, Math.min(1, nx)),
    y: Math.max(0, Math.min(1, ny)),
  }
}

function layerIdsFromMapsTs() {
  const src = readFileSync(MAPS_TS, 'utf8')
  const ids = new Set()
  for (const m of src.matchAll(/\{\s*id:\s*'([^']+)'/g)) ids.add(m[1])
  return ids
}

function displayName(raw) {
  const parts = raw.split('-')
  if (parts.length < 2) return raw
  return parts.slice(1).join(' ').replace(/([a-z])([A-Z])/g, '$1 $2')
}

async function main() {
  const wanted = layerIdsFromMapsTs()
  console.log(`Layer ids in maps.ts: ${wanted.size}`)

  const res = await fetch(WIKI_URL)
  if (!res.ok) throw new Error(`Wiki fetch failed: ${res.status}`)
  const wiki = await res.json()
  const maps = wiki.Maps ?? []
  const out = {}

  let matched = 0
  for (const layer of maps) {
    if (!ALLOWED_MODES.has(layer.gamemode)) continue
    if (!wanted.has(layer.rawName)) continue

    const order = layer.capturePoints?.points?.pointsOrder
    const objectives = layer.objectives
    const corners = layer.mapTextureCorners
    if (!order?.length || !objectives || !corners) continue

    const points = []
    for (const name of order) {
      const key = findObjectiveKey(objectives, name)
      if (!key) continue
      const obj = objectives[key]
      const pos = worldToNorm(obj.location_x, obj.location_y, corners)
      if (!pos) continue
      points.push({
        id: key,
        name: obj.name || displayName(name),
        x: Math.round(pos.x * 10000) / 10000,
        y: Math.round(pos.y * 10000) / 10000,
      })
    }
    if (points.length) {
      out[layer.rawName] = points
      matched++
    }
  }

  writeFileSync(OUT, JSON.stringify(out))
  console.log(`Wrote ${matched} layers to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
