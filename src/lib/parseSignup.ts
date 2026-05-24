/** Parse common Squad sign-up / Excel paste formats into structured rows. */

export interface SignupRow {
  name: string
  role?: string
  squad?: string
}

const ROLE_ALIASES: Record<string, string> = {
  sl: 'sl',
  squadleader: 'sl',
  'squad leader': 'sl',
  medic: 'medic',
  med: 'medic',
  lat: 'lat',
  hat: 'hat',
  mg: 'mg',
  marksman: 'marksman',
  mark: 'marksman',
  rifleman: 'rifleman',
  rif: 'rifleman',
  grenadier: 'grenadier',
  gre: 'grenadier',
}

function normRole(raw: string): string | undefined {
  const k = raw.trim().toLowerCase().replace(/[^a-z ]/g, '')
  return ROLE_ALIASES[k] ?? (k.length <= 12 ? k : undefined)
}

/** One player per line from Discord, Excel, or in-game sign-up lists. */
export function parseSignupText(raw: string): SignupRow[] {
  const rows: SignupRow[] = []
  const lines = raw.split(/\n+/)

  for (const line of lines) {
    let s = line.trim()
    if (!s || /^#/.test(s) || /^-+$/i.test(s)) continue
    s = s.replace(/^[\d]+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim()

    // [Alpha] Name or Alpha: Name
    let squad: string | undefined
    const squadBracket = s.match(/^\[([^\]]+)\]\s*(.+)$/)
    if (squadBracket) {
      squad = squadBracket[1].trim()
      s = squadBracket[2].trim()
    } else {
      const squadColon = s.match(/^([A-Za-z0-9 ]{2,20}):\s*(.+)$/)
      if (squadColon && !squadColon[1].includes('@')) {
        squad = squadColon[1].trim()
        s = squadColon[2].trim()
      }
    }

    // Tab-separated (Excel): Name \t Role \t Squad
    if (s.includes('\t')) {
      const parts = s.split('\t').map((x) => x.trim()).filter(Boolean)
      if (parts.length >= 1) {
        rows.push({
          name: parts[0],
          role: parts[1] ? normRole(parts[1]) : undefined,
          squad: parts[2] ?? squad,
        })
        continue
      }
    }

    // SL | Name or Name | SL
    if (s.includes('|')) {
      const [a, b] = s.split('|').map((x) => x.trim())
      const roleA = normRole(a)
      const roleB = normRole(b)
      if (roleA && !roleB) rows.push({ name: b, role: roleA, squad })
      else if (roleB && !roleA) rows.push({ name: a, role: roleB, squad })
      else rows.push({ name: s.replace(/\|/g, ' ').trim(), squad })
      continue
    }

    // Name - SL or SL - Name
    const dash = s.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (dash) {
      const roleL = normRole(dash[1])
      const roleR = normRole(dash[2])
      if (roleL && !roleR) rows.push({ name: dash[2].trim(), role: roleL, squad })
      else if (roleR && !roleL) rows.push({ name: dash[1].trim(), role: roleR, squad })
      else rows.push({ name: s, squad })
      continue
    }

    // Name (SL)
    const paren = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (paren) {
      rows.push({ name: paren[1].trim(), role: normRole(paren[2]), squad })
      continue
    }

    rows.push({ name: s, squad })
  }

  const seen = new Set<string>()
  return rows.filter((r) => {
    const k = r.name.toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}
