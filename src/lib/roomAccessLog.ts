import { nanoid } from 'nanoid'
import { supabase, isSupabaseConfigured } from './supabase'

export interface RoomAccessEvent {
  id: string
  roomId: string
  memberId: string
  memberName: string | null
  authUserId: string | null
  authEmail: string | null
  role: string | null
  isHost: boolean
  viewOnly: boolean
  userAgent: string | null
  referrer: string | null
  createdAt: string
  // Extended telemetry (migration 006)
  visitorId: string | null
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  org: string | null
  timezone: string | null
  languages: string | null
  screen: string | null
  viewport: string | null
  devicePixelRatio: number | null
  platform: string | null
  cpuCores: number | null
  deviceMemory: number | null
  touch: boolean | null
  connection: string | null
  landingUrl: string | null
}

export interface LogRoomAccessInput {
  roomId: string
  memberId: string
  memberName: string
  role?: string
  isHost?: boolean
  viewOnly?: boolean
  authUserId?: string | null
  authEmail?: string | null
}

// One join row per room per page session — heartbeats / re-renders must not spam.
const logged = new Set<string>()

export function accessLogEnabled() {
  return isSupabaseConfigured && !!supabase
}

const VISITOR_KEY = 'ct:visitor:id'

/** Stable id for this browser profile, so returning visitors are recognised. */
export function persistentVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = nanoid(16)
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

interface GeoInfo {
  ip: string | null
  country: string | null
  region: string | null
  city: string | null
  org: string | null
}

/** Best-effort public IP + coarse location from a free, key-less endpoint. */
async function lookupGeo(): Promise<GeoInfo> {
  const empty: GeoInfo = { ip: null, country: null, region: null, city: null, org: null }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return empty
    const j = (await res.json()) as {
      success?: boolean
      ip?: string
      country?: string
      region?: string
      city?: string
      connection?: { isp?: string; org?: string }
    }
    if (j.success === false) return empty
    return {
      ip: j.ip ?? null,
      country: j.country ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      org: j.connection?.isp ?? j.connection?.org ?? null,
    }
  } catch {
    return empty
  }
}

interface DeviceInfo {
  timezone: string | null
  languages: string | null
  screen: string | null
  viewport: string | null
  devicePixelRatio: number | null
  platform: string | null
  cpuCores: number | null
  deviceMemory: number | null
  touch: boolean | null
  connection: string | null
}

function collectDevice(): DeviceInfo {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      timezone: null, languages: null, screen: null, viewport: null, devicePixelRatio: null,
      platform: null, cpuCores: null, deviceMemory: null, touch: null, connection: null,
    }
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { effectiveType?: string }
    userAgentData?: { platform?: string }
  }
  let timezone: string | null
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    timezone = null
  }
  return {
    timezone,
    languages: nav.languages?.length ? nav.languages.join(', ') : nav.language || null,
    screen: window.screen ? `${window.screen.width}x${window.screen.height}` : null,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : null,
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    cpuCores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    touch: 'ontouchstart' in window || (nav.maxTouchPoints ?? 0) > 0,
    connection: nav.connection?.effectiveType ?? null,
  }
}

export async function logRoomAccess(input: LogRoomAccessInput): Promise<void> {
  if (!accessLogEnabled() || !input.roomId) return
  if (logged.has(input.roomId)) return
  logged.add(input.roomId)
  try {
    const device = collectDevice()
    const geo = await lookupGeo()
    const { error } = await supabase!.from('room_access_events').insert({
      room_id: input.roomId,
      member_id: input.memberId,
      member_name: input.memberName || null,
      auth_user_id: input.authUserId ?? null,
      auth_email: input.authEmail ?? null,
      role: input.role ?? null,
      is_host: input.isHost ?? false,
      view_only: input.viewOnly ?? false,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : null,
      visitor_id: persistentVisitorId(),
      ip: geo.ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      org: geo.org,
      timezone: device.timezone,
      languages: device.languages,
      screen: device.screen,
      viewport: device.viewport,
      device_pixel_ratio: device.devicePixelRatio,
      platform: device.platform,
      cpu_cores: device.cpuCores,
      device_memory: device.deviceMemory,
      touch: device.touch,
      connection: device.connection,
      landing_url: typeof window !== 'undefined' ? window.location.href : null,
    })
    if (error) logged.delete(input.roomId) // allow a later retry
  } catch {
    logged.delete(input.roomId)
  }
}

function num(v: unknown): number | null {
  return v == null ? null : Number(v)
}

function mapRow(r: Record<string, unknown>): RoomAccessEvent {
  return {
    id: String(r.id),
    roomId: String(r.room_id),
    memberId: String(r.member_id ?? ''),
    memberName: (r.member_name as string | null) ?? null,
    authUserId: (r.auth_user_id as string | null) ?? null,
    authEmail: (r.auth_email as string | null) ?? null,
    role: (r.role as string | null) ?? null,
    isHost: Boolean(r.is_host),
    viewOnly: Boolean(r.view_only),
    userAgent: (r.user_agent as string | null) ?? null,
    referrer: (r.referrer as string | null) ?? null,
    createdAt: String(r.created_at),
    visitorId: (r.visitor_id as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    region: (r.region as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    org: (r.org as string | null) ?? null,
    timezone: (r.timezone as string | null) ?? null,
    languages: (r.languages as string | null) ?? null,
    screen: (r.screen as string | null) ?? null,
    viewport: (r.viewport as string | null) ?? null,
    devicePixelRatio: num(r.device_pixel_ratio),
    platform: (r.platform as string | null) ?? null,
    cpuCores: num(r.cpu_cores),
    deviceMemory: num(r.device_memory),
    touch: r.touch == null ? null : Boolean(r.touch),
    connection: (r.connection as string | null) ?? null,
    landingUrl: (r.landing_url as string | null) ?? null,
  }
}

const SELECT =
  'id, room_id, member_id, member_name, auth_user_id, auth_email, role, is_host, view_only, user_agent, referrer, created_at, visitor_id, ip, country, region, city, org, timezone, languages, screen, viewport, device_pixel_ratio, platform, cpu_cores, device_memory, touch, connection, landing_url'

export async function fetchRoomAccessEvents(roomId: string, limit = 1000): Promise<RoomAccessEvent[]> {
  if (!accessLogEnabled() || !roomId) return []
  const { data, error } = await supabase!
    .from('room_access_events')
    .select(SELECT)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(mapRow)
}

export async function fetchRecentAccessEvents(limit = 2000): Promise<RoomAccessEvent[]> {
  if (!accessLogEnabled()) return []
  const { data, error } = await supabase!
    .from('room_access_events')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(mapRow)
}

// ---------------------------------------------------------------------------
// Aggregation: collapse raw join rows into one entry per visitor.
// ---------------------------------------------------------------------------

export interface VisitorSummary {
  key: string
  memberId: string
  visitorId: string | null
  name: string
  authEmail: string | null
  signedIn: boolean
  isHost: boolean
  bestRole: string | null
  viewOnly: boolean
  visits: number
  firstSeen: string
  lastSeen: string
  device: string
  external: boolean
  flags: string[]
  // Latest known raw details for the full breakdown
  latest: RoomAccessEvent
  location: string | null
}

export interface RoomSummary {
  roomId: string
  visitors: VisitorSummary[]
  totalVisits: number
  uniqueVisitors: number
  guests: number
  signedIn: number
  hosts: number
  lastSeen: string
  flags: string[]
}

const roleRank: Record<string, number> = { host: 3, editor: 2, viewer: 1 }

/** Short, human-readable device/browser label from a user-agent string. */
export function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other OS'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser'
  return `${browser} · ${os}`
}

function isExternalReferrer(referrer: string | null): boolean {
  if (!referrer) return false
  try {
    const host = new URL(referrer).host
    const here = typeof window !== 'undefined' ? window.location.host : ''
    return !!host && host !== here
  } catch {
    return false
  }
}

function locationLabel(e: RoomAccessEvent): string | null {
  const parts = [e.city, e.region, e.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function summarizeRoom(roomId: string, events: RoomAccessEvent[]): RoomSummary {
  const byMember = new Map<string, RoomAccessEvent[]>()
  for (const e of events) {
    const key = e.visitorId || e.memberId
    const arr = byMember.get(key) ?? []
    arr.push(e)
    byMember.set(key, arr)
  }

  const visitors: VisitorSummary[] = []
  for (const [key, rows] of byMember) {
    const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const latest = sorted[sorted.length - 1]
    const named = [...sorted].reverse().find((r) => r.memberName?.trim())
    const emailed = sorted.find((r) => r.authEmail)
    const signedIn = !!emailed
    const isHost = sorted.some((r) => r.isHost)
    const bestRole =
      sorted
        .map((r) => (r.isHost ? 'host' : r.role))
        .filter(Boolean)
        .sort((a, b) => (roleRank[b ?? ''] ?? 0) - (roleRank[a ?? ''] ?? 0))[0] ?? null
    const external = sorted.some((r) => isExternalReferrer(r.referrer))

    const flags: string[] = []
    if (!signedIn && !isHost) flags.push('Guest (not signed in)')
    if (external) flags.push('External link source')
    if (latest.viewOnly) flags.push('View-only link')

    visitors.push({
      key,
      memberId: latest.memberId,
      visitorId: latest.visitorId,
      name: named?.memberName?.trim() || emailed?.authEmail?.split('@')[0] || 'Guest',
      authEmail: emailed?.authEmail ?? null,
      signedIn,
      isHost,
      bestRole,
      viewOnly: latest.viewOnly,
      visits: sorted.length,
      firstSeen: sorted[0].createdAt,
      lastSeen: latest.createdAt,
      device: parseDevice(latest.userAgent),
      external,
      flags,
      latest,
      location: locationLabel(latest),
    })
  }

  visitors.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))

  const guests = visitors.filter((v) => !v.signedIn && !v.isHost).length
  const signedIn = visitors.filter((v) => v.signedIn).length
  const hosts = visitors.filter((v) => v.isHost).length
  const nonHostVisitors = visitors.filter((v) => !v.isHost).length

  const flags: string[] = []
  if (nonHostVisitors >= 6) flags.push(`${nonHostVisitors} people accessed this room`)
  if (guests > 0) flags.push(`${guests} guest${guests > 1 ? 's' : ''} (no account)`)
  if (visitors.some((v) => v.external)) flags.push('Opened from an external link')

  return {
    roomId,
    visitors,
    totalVisits: events.length,
    uniqueVisitors: visitors.length,
    guests,
    signedIn,
    hosts,
    lastSeen: visitors[0]?.lastSeen ?? '',
    flags,
  }
}

export function summarizeAllRooms(events: RoomAccessEvent[]): RoomSummary[] {
  const byRoom = new Map<string, RoomAccessEvent[]>()
  for (const e of events) {
    const arr = byRoom.get(e.roomId) ?? []
    arr.push(e)
    byRoom.set(e.roomId, arr)
  }
  return [...byRoom.entries()]
    .map(([roomId, rows]) => summarizeRoom(roomId, rows))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}
