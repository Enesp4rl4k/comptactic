import type { MapInfo } from '../types'

// Curated seed of popular Squad maps + layers. Capture-point coordinates are
// normalized (0..1) over the map image. This is a starter set; the full dataset
// (all layers + extracted backgrounds) is ingested from community sources in a
// follow-up — the renderer falls back to a tactical grid when an image is absent.

export const MAPS: MapInfo[] = [
  {
    id: 'yehorivka',
    name: 'Yehorivka',
    image: '/maps/yehorivka.jpg',
    sizeMeters: 3060,
    layers: [
      {
        id: 'yehorivka_raas_v1',
        name: 'Yehorivka RAAS v1',
        mode: 'RAAS',
        factions: ['USA', 'RUS'],
        time: 'Day',
        capturePoints: [
          { id: 'cp1', name: 'Lower Storage', x: 0.18, y: 0.74 },
          { id: 'cp2', name: 'Sazha River', x: 0.34, y: 0.6 },
          { id: 'cp3', name: 'Hilltop Encampment', x: 0.5, y: 0.5 },
          { id: 'cp4', name: 'Mogiloy', x: 0.66, y: 0.4 },
          { id: 'cp5', name: 'Upper Storage', x: 0.82, y: 0.26 },
        ],
      },
      { id: 'yehorivka_aas_v1', name: 'Yehorivka AAS v1', mode: 'AAS', factions: ['GB', 'RUS'], time: 'Day' },
      { id: 'yehorivka_invasion_v1', name: 'Yehorivka Invasion v1', mode: 'Invasion', factions: ['USA', 'INS'], time: 'Night' },
    ],
  },
  {
    id: 'gorodok',
    name: 'Gorodok',
    image: '/maps/gorodok.jpg',
    sizeMeters: 3500,
    layers: [
      { id: 'gorodok_raas_v1', name: 'Gorodok RAAS v1', mode: 'RAAS', factions: ['USA', 'RUS'], time: 'Day' },
      { id: 'gorodok_aas_v1', name: 'Gorodok AAS v1', mode: 'AAS', factions: ['GB', 'RUS'], time: 'Day' },
      { id: 'gorodok_invasion_v1', name: 'Gorodok Invasion v1', mode: 'Invasion', factions: ['CAF', 'INS'], time: 'Dusk' },
    ],
  },
  {
    id: 'narva',
    name: 'Narva',
    image: '/maps/narva.jpg',
    sizeMeters: 2800,
    layers: [
      { id: 'narva_raas_v1', name: 'Narva RAAS v1', mode: 'RAAS', factions: ['USA', 'RUS'], time: 'Day' },
      { id: 'narva_aas_v1', name: 'Narva AAS v1', mode: 'AAS', factions: ['GB', 'RUS'], time: 'Day' },
      { id: 'narva_destruction_v1', name: 'Narva Destruction v1', mode: 'Destruction', factions: ['USA', 'RUS'], time: 'Day' },
    ],
  },
  {
    id: 'fallujah',
    name: 'Fallujah',
    image: '/maps/fallujah.jpg',
    sizeMeters: 2900,
    layers: [
      { id: 'fallujah_raas_v1', name: 'Fallujah RAAS v1', mode: 'RAAS', factions: ['USA', 'INS'], time: 'Day' },
      { id: 'fallujah_invasion_v1', name: 'Fallujah Invasion v1', mode: 'Invasion', factions: ['USMC', 'INS'], time: 'Day' },
      { id: 'fallujah_skirmish_v1', name: 'Fallujah Skirmish v1', mode: 'Skirmish', factions: ['USA', 'RUS'], time: 'Day' },
    ],
  },
  {
    id: 'gooseBay',
    name: 'Goose Bay',
    image: '/maps/goosebay.jpg',
    sizeMeters: 3600,
    layers: [
      { id: 'goosebay_raas_v1', name: 'Goose Bay RAAS v1', mode: 'RAAS', factions: ['CAF', 'RUS'], time: 'Day' },
      { id: 'goosebay_invasion_v1', name: 'Goose Bay Invasion v1', mode: 'Invasion', factions: ['USA', 'RUS'], time: 'Dawn' },
    ],
  },
  {
    id: 'mutaha',
    name: 'Mutaha',
    image: '/maps/mutaha.jpg',
    sizeMeters: 2300,
    layers: [
      { id: 'mutaha_raas_v1', name: 'Mutaha RAAS v1', mode: 'RAAS', factions: ['USA', 'RUS'], time: 'Day' },
      { id: 'mutaha_aas_v1', name: 'Mutaha AAS v1', mode: 'AAS', factions: ['GB', 'MEA'], time: 'Day' },
    ],
  },
  {
    id: 'harju',
    name: 'Harju',
    image: '/maps/harju.jpg',
    sizeMeters: 4000,
    layers: [
      { id: 'harju_raas_v1', name: 'Harju RAAS v1', mode: 'RAAS', factions: ['USA', 'RUS'], time: 'Day' },
      { id: 'harju_aas_v1', name: 'Harju AAS v1', mode: 'AAS', factions: ['GB', 'RUS'], time: 'Day' },
    ],
  },
  {
    id: 'manicouagan',
    name: 'Manicouagan',
    image: '/maps/manicouagan.jpg',
    sizeMeters: 4000,
    layers: [
      { id: 'manic_raas_v1', name: 'Manicouagan RAAS v1', mode: 'RAAS', factions: ['CAF', 'RUS'], time: 'Day' },
      { id: 'manic_invasion_v1', name: 'Manicouagan Invasion v1', mode: 'Invasion', factions: ['USA', 'RUS'], time: 'Day' },
    ],
  },
  {
    id: 'talil',
    name: 'Tallil Outskirts',
    image: '/maps/talil.jpg',
    sizeMeters: 3200,
    layers: [
      { id: 'talil_raas_v1', name: 'Tallil RAAS v1', mode: 'RAAS', factions: ['USA', 'RUS'], time: 'Day' },
      { id: 'talil_tc_v1', name: 'Tallil TC v1', mode: 'TC', factions: ['GB', 'MEA'], time: 'Day' },
    ],
  },
  {
    id: 'albasrah',
    name: 'Al Basrah',
    image: '/maps/albasrah.jpg',
    sizeMeters: 2800,
    layers: [
      { id: 'albasrah_raas_v1', name: 'Al Basrah RAAS v1', mode: 'RAAS', factions: ['USA', 'INS'], time: 'Day' },
      { id: 'albasrah_insurgency_v1', name: 'Al Basrah Insurgency v1', mode: 'Insurgency', factions: ['GB', 'INS'], time: 'Day' },
    ],
  },
]

export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]))
