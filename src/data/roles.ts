// Squad kit roles used in competitive line-ups.
export interface RoleDef {
  id: string
  name: string
  short: string
}

export const ROLES: RoleDef[] = [
  { id: 'sl', name: 'Squad Leader', short: 'SL' },
  { id: 'medic', name: 'Medic', short: 'MED' },
  { id: 'ar', name: 'Automatic Rifleman', short: 'AR' },
  { id: 'rifleman', name: 'Rifleman', short: 'RFL' },
  { id: 'marksman', name: 'Marksman', short: 'DMR' },
  { id: 'lat', name: 'Light Anti-Tank', short: 'LAT' },
  { id: 'hat', name: 'Heavy Anti-Tank', short: 'HAT' },
  { id: 'mg', name: 'Machine Gunner', short: 'MG' },
  { id: 'grenadier', name: 'Grenadier', short: 'GR' },
  { id: 'engineer', name: 'Combat Engineer', short: 'ENG' },
  { id: 'crewman', name: 'Crewman', short: 'CRW' },
  { id: 'pilot', name: 'Pilot', short: 'PLT' },
]

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]))
