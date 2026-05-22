import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import AssetPalette from './components/AssetPalette'
import RosterPanel from './components/RosterPanel'
import MapPicker from './components/MapPicker'
import TacticalBoard from './components/TacticalBoard'
import SlidesBar from './components/SlidesBar'
import LineupGrid from './components/LineupGrid'
import LayersPanel from './components/LayersPanel'
import LayerInfoPanel from './components/LayerInfoPanel'
import PlayerPool from './components/PlayerPool'
import TacticSheet from './components/TacticSheet'
import AuthModal from './components/AuthModal'
import PlansModal from './components/PlansModal'
import BriefingMode from './components/BriefingMode'
import TemplatesModal from './components/TemplatesModal'
import { createShare, getShare, createPlan, updatePlan } from './lib/plans'
import { useAuth, signOut } from './lib/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { startCollab, getRoomId } from './lib/collab'
import { usePresence } from './lib/presence'
import type { BoardSnapshot } from './types'
import { useBoardStore } from './store/useBoardStore'
import { MAP_BY_ID } from './data/maps'
import {
  saveLocal,
  loadLocal,
  encodeToHash,
  decodeFromHash,
  exportPNG,
} from './lib/persist'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('Untitled plan')
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'lineup' | 'sheet'>('board')
  const store = useBoardStore()
  const { user } = useAuth()
  const map = store.mapId ? MAP_BY_ID[store.mapId] : null
  const mapLabel = store.customImage ? store.customImageName || 'Custom image' : map ? map.name : 'Select Map'

  // load shared plan: ?s=<id> short link, then #hash, else autosave
  useEffect(() => {
    const shortId = new URLSearchParams(window.location.search).get('s')
    if (shortId) {
      getShare(shortId).then((snap) => {
        if (snap) store.loadSnapshot(snap)
        else {
          const auto = loadLocal()
          if (auto) store.loadSnapshot(auto)
        }
      })
      return
    }
    const fromHash = decodeFromHash()
    if (fromHash) {
      store.loadSnapshot(fromHash)
      return
    }
    const auto = loadLocal()
    if (auto) store.loadSnapshot(auto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // realtime collaboration: broadcast local board changes, apply peers' changes
  useEffect(() => {
    let applyingRemote = false
    let lastSent = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    const room = getRoomId()
    const handle = startCollab(
      room,
      (snap) => {
        applyingRemote = true
        useBoardStore.getState().applyRemote(snap)
        applyingRemote = false
      },
      () => useBoardStore.getState().toSnapshot(),
    )
    const unsub = useBoardStore.subscribe(() => {
      if (applyingRemote) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const snap = useBoardStore.getState().toSnapshot()
        // Dedup on the active content only (slides already hold the live elements);
        // `boards` is a per-layer cache duplicate, so stringifying it too is wasted work.
        const key = JSON.stringify({
          m: snap.mapId,
          l: snap.layerId,
          ak: snap.activeKey,
          sl: snap.slides,
          s: snap.squads,
          v: snap.vehicles,
          p: snap.playerPool,
        })
        if (key === lastSent) return // skip selection/tool-only changes
        lastSent = key
        handle.broadcast(snap)
      }, 150)
    })
    return () => {
      clearTimeout(timer)
      unsub()
      handle.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // presence: join the room, default the display name from the signed-in email.
  // The client that created the room (no ?room in the URL) is the host; the flag
  // is persisted per-room so a refresh keeps host rights.
  useEffect(() => {
    const hadRoom = !!new URLSearchParams(window.location.search).get('room')
    const room = getRoomId()
    const hostKey = 'ct:host:' + room
    const isHost = hadRoom ? localStorage.getItem(hostKey) === '1' : true
    if (isHost) localStorage.setItem(hostKey, '1')
    usePresence.getState().setHost(isHost)
    const stop = usePresence.getState().start(room)
    return stop
  }, [])
  useEffect(() => {
    const p = usePresence.getState()
    if (!p.name && user?.email) p.setName(user.email.split('@')[0])
  }, [user])

  // autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => saveLocal(store.toSnapshot()), 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.elements, store.slides, store.activeSlideId, store.boards, store.activeKey, store.squads, store.vehicles, store.playerPool, store.mapId, store.layerId, store.customImage])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const copyLink = async (url: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(url)
      history.replaceState(null, '', url)
      flash(msg)
    } catch {
      history.replaceState(null, '', url)
      flash('Link written to the address bar')
    }
  }

  // Share = open the plan AND join the same live room, so opening the link starts
  // real-time collaboration (edits sync both ways).
  const onShare = async () => {
    const room = getRoomId()
    const base = `${window.location.origin}${window.location.pathname}`
    // Prefer a short DB-backed link when Supabase is configured.
    if (isSupabaseConfigured) {
      try {
        const id = await createShare(store.toSnapshot())
        await copyLink(`${base}?s=${id}&room=${room}`, 'Live share link copied — edits sync in real time')
        return
      } catch {
        /* fall back to hash link */
      }
    }
    const b64 = encodeToHash(store.toSnapshot()).split('#plan=')[1] ?? ''
    await copyLink(`${base}?room=${room}#plan=${b64}`, 'Live share link copied — edits sync in real time')
  }

  // Save the current plan to the cloud (create or update).
  const onSave = async () => {
    if (!isSupabaseConfigured) {
      flash('Cloud saving is not configured')
      return
    }
    if (!user) {
      setAuthOpen(true)
      flash('Sign in to save your plan')
      return
    }
    try {
      const snap = store.toSnapshot()
      if (currentPlanId) {
        await updatePlan(currentPlanId, { data: snap })
        flash('Plan saved to cloud')
      } else {
        const title = window.prompt('Plan name:', currentTitle) ?? currentTitle
        const id = await createPlan(title, snap)
        setCurrentPlanId(id)
        setCurrentTitle(title)
        flash('Plan saved to cloud')
      }
    } catch {
      flash('Could not save — check your connection / sign-in')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <header className="flex items-center gap-3 px-4 h-12 bg-panel border-b border-edge shrink-0">
        <div className="font-display font-bold text-base tracking-wide text-accent select-none">
          Comp<span className="text-white">Tactic</span>
        </div>
        <button onClick={() => setPickerOpen(true)} className="btn btn-primary max-w-[200px] truncate">
          {mapLabel}
        </button>

        <div className="ml-2 flex items-center rounded-lg bg-panel2 border border-edge p-0.5">
          <TabBtn active={view === 'board'} onClick={() => setView('board')}>
            Board
          </TabBtn>
          <TabBtn active={view === 'lineup'} onClick={() => setView('lineup')}>
            Line-up
          </TabBtn>
          <TabBtn active={view === 'sheet'} onClick={() => setView('sheet')}>
            Tactic Sheet
          </TabBtn>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn btn-success" onClick={onSave} title="Save to cloud">Save</button>
          <button className="btn" onClick={() => setTemplatesOpen(true)} title="Templates &amp; library">Templates</button>
          {view === 'board' && (
            <button className="btn" onClick={() => setBriefingOpen(true)} title="Play slides fullscreen">▶ Briefing</button>
          )}
          <ExportMenu
            onPNG={() => exportPNG()}
            onPDF={async () => { flash('Exporting PDF…'); const { exportSlidesPDF } = await import('./lib/exportSlides'); const ok = await exportSlidesPDF(); if (!ok) flash('Open the Board with a map first') }}
            onAllPNG={async () => { flash('Exporting PNG…'); const { exportSlidesPNG } = await import('./lib/exportSlides'); const ok = await exportSlidesPNG(); if (!ok) flash('Open the Board with a map first') }}
          />
          <button className="btn btn-success" onClick={onShare} title="Copy a live link — others editing it sync in real time">Share</button>
          {isSupabaseConfigured && (
            <button className="btn" onClick={() => setPlansOpen(true)}>☁ Plans</button>
          )}
          <OnlineBar />
          <div className="mx-1 h-6 w-px bg-edge" />
          {user ? (
            <UserMenu email={user.email ?? 'Account'} onSignOut={() => signOut()} />
          ) : (
            <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>Sign in</button>
          )}
        </div>
      </header>

      {view === 'board' && <Toolbar />}

      {/* main */}
      {view === 'board' && (
        <div className="flex flex-1 min-h-0">
          <RosterPanel />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 relative">
              <TacticalBoard />
              <LayersPanel />
            </div>
            <SlidesBar />
          </div>
          <AssetPalette />
        </div>
      )}
      {view === 'lineup' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <LayerInfoPanel />
          <PlayerPool />
          <LineupGrid />
        </div>
      )}
      {view === 'sheet' && (
        <div className="flex-1 min-h-0">
          <TacticSheet />
        </div>
      )}

      {pickerOpen && <MapPicker onClose={() => setPickerOpen(false)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {plansOpen && (
        <PlansModal
          onClose={() => setPlansOpen(false)}
          getSnapshot={() => store.toSnapshot()}
          currentPlanId={currentPlanId}
          currentTitle={currentTitle}
          onRequireSignIn={() => setAuthOpen(true)}
          onSaved={(id, title) => { setCurrentPlanId(id); setCurrentTitle(title); flash('Plan saved to cloud') }}
          onOpenPlan={(id, title, data: BoardSnapshot) => {
            store.loadSnapshot(data)
            setCurrentPlanId(id)
            setCurrentTitle(title)
            flash(`Opened “${title}”`)
          }}
        />
      )}

      {briefingOpen && <BriefingMode onClose={() => setBriefingOpen(false)} />}
      {templatesOpen && <TemplatesModal onClose={() => setTemplatesOpen(false)} flash={flash} />}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-panel2 border border-edge text-white text-sm px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

// Session members. Avatars open a dropdown listing everyone in the room; the
// host (session creator) can rename themselves and kick other members.
function OnlineBar() {
  const peers = usePresence((s) => s.peers)
  const name = usePresence((s) => s.name)
  const color = usePresence((s) => s.color)
  const host = usePresence((s) => s.host)
  const setName = usePresence((s) => s.setName)
  const kick = usePresence((s) => s.kick)
  const [open, setOpen] = useState(false)
  const others = Object.values(peers)
  const total = others.length + 1
  const initial = (n: string) => (n.trim().charAt(0) || '?').toUpperCase()

  return (
    <div className="relative mr-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 cursor-pointer"
        title={`${total} in session`}
      >
        <div className="flex items-center -space-x-1.5">
          <span className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold text-black ring-2 ring-panel" style={{ background: color }}>
            {initial(name || 'You')}
          </span>
          {others.slice(0, 3).map((p) => (
            <span key={p.id} className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold text-black ring-2 ring-panel" style={{ background: p.color }}>
              {initial(p.name)}
            </span>
          ))}
        </div>
        {total > 4 && <span className="text-xs text-gray-400">+{total - 4}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 z-50 w-64 rounded-md border border-edge bg-panel2 shadow-panel overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-edge">In this session · {total}</div>

            {/* you */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-black" style={{ background: color }}>
                {initial(name || 'You')}
              </span>
              <span className="text-sm text-gray-100 truncate">{name || 'You'} <span className="text-gray-500">(you)</span></span>
              {host && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">HOST</span>}
              <button
                onClick={() => { const n = window.prompt('Your display name:', name); if (n != null) setName(n.trim()) }}
                className="ml-auto text-[11px] text-gray-400 hover:text-white cursor-pointer"
              >
                rename
              </button>
            </div>

            {/* peers */}
            {others.length === 0 && <div className="px-3 py-2 text-[11px] text-gray-600">No one else here yet. Use Share to invite.</div>}
            {others.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 border-t border-edge/60">
                <span className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-black" style={{ background: p.color }}>
                  {initial(p.name)}
                </span>
                <span className="text-sm text-gray-200 truncate">{p.name}</span>
                {p.host && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">HOST</span>}
                {host && (
                  <button
                    onClick={() => { if (confirm(`Remove ${p.name} from the session?`)) kick(p.id) }}
                    className="ml-auto text-[11px] px-2 py-0.5 rounded border border-edge text-gray-400 hover:text-red-400 hover:border-red-500/60 cursor-pointer"
                    title="Kick"
                  >
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ExportMenu({ onPNG, onPDF, onAllPNG }: { onPNG: () => void; onPDF: () => void; onAllPNG: () => void }) {
  const [open, setOpen] = useState(false)
  const item = 'block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-edge cursor-pointer'
  const run = (fn: () => void) => { setOpen(false); fn() }
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen((v) => !v)} title="Export">Export ▾</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 z-50 w-52 rounded-md border border-edge bg-panel2 shadow-panel overflow-hidden">
            <button className={item} onClick={() => run(onPNG)}>PNG · current slide</button>
            <button className={item} onClick={() => run(onPDF)}>PDF · all slides</button>
            <button className={item} onClick={() => run(onAllPNG)}>PNG · all slides</button>
          </div>
        </>
      )}
    </div>
  )
}

function TabBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-7 rounded-md text-sm font-medium transition-colors cursor-pointer ${
        active ? 'bg-accent text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-edge/60'
      }`}
    >
      {children}
    </button>
  )
}

function UserMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const initial = email.trim().charAt(0).toUpperCase() || 'U'
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={email}
        className="h-8 w-8 rounded-full bg-accent text-white text-sm font-semibold grid place-items-center cursor-pointer hover:brightness-110"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 z-50 w-56 rounded-md border border-edge bg-panel2 shadow-panel overflow-hidden">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-edge truncate">{email}</div>
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-edge cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
