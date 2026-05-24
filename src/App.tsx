import { useEffect, useMemo, useState } from 'react'
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
import ShortcutsModal from './components/ShortcutsModal'
import SpawnTimeline from './components/SpawnTimeline'
import { IconChevronDown, IconCloud, IconHelp, IconMap, IconPlay } from './components/ui/Icons'
import HomeScreen from './components/HomeScreen'
import { createShare, getShare, createPlan, updatePlan } from './lib/plans'
import { useAuth, signOut } from './lib/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { createNewRoom } from './lib/collab'
import { createAndEnterRoom, enterRoom, leaveToHome, resolveInitialRoomId } from './lib/roomEntry'
import { useCollabSync } from './hooks/useCollabSync'
import CollabBanner from './components/CollabBanner'
import RoomMembersModal from './components/RoomMembersModal'
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
  clearLocal,
} from './lib/persist'
import { loadCapturePoints } from './lib/capturePoints'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('Untitled plan')
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'lineup' | 'sheet'>('board')
  const [roomId, setRoomId] = useState<string | null>(() => resolveInitialRoomId())
  const [membersOpen, setMembersOpen] = useState(false)
  const search = useMemo(() => new URLSearchParams(window.location.search), [])
  const urlViewOnly = search.get('view') === '1'
  const embed = search.get('embed') === '1'
  const host = usePresence((s) => s.host)
  const myRole = usePresence((s) => s.myRole)
  const canEdit = !urlViewOnly && (host || myRole === 'editor')
  const readOnly = !canEdit
  const store = useBoardStore()
  const { user } = useAuth()
  const map = store.mapId ? MAP_BY_ID[store.mapId] : null
  const layerId = store.layerId
  const mapLabel = store.customImage ? store.customImageName || 'Custom image' : map ? map.name : 'Select Map'

  const collabNotice = useBoardStore((s) => s.collabNotice)
  const clearCollabNotice = useBoardStore((s) => s.clearCollabNotice)

  useEffect(() => {
    const run = () => {
      void loadCapturePoints()
    }
    const ric = window.requestIdleCallback
    if (ric) {
      const id = ric(run, { timeout: 2500 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(run, 150)
    return () => clearTimeout(t)
  }, [])

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

  // Realtime collaboration (adaptive sync in useCollabSync)
  useCollabSync(roomId ?? '', readOnly)

  // presence: join the room, default the display name from the signed-in email.
  // The client that created the room (no ?room in the URL) is the host; the flag
  // is persisted per-room so a refresh keeps host rights.
  useEffect(() => {
    if (!roomId) return
    const hostKey = 'ct:host:' + roomId
    const isHost = localStorage.getItem(hostKey) === '1'
    if (isHost) localStorage.setItem(hostKey, '1')
    usePresence.getState().setHost(isHost)
    if (isHost) usePresence.getState().initRoomPolicy(roomId)
    const stop = usePresence.getState().start(roomId)
    return stop
  }, [roomId])
  useEffect(() => {
    const p = usePresence.getState()
    if (!p.name && user?.email) p.setName(user.email.split('@')[0])
  }, [user])

  // autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => saveLocal(store.toSnapshot()), 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store.elements,
    store.slides,
    store.activeSlideId,
    store.boards,
    store.activeKey,
    store.squads,
    store.vehicles,
    store.playerPool,
    store.mapId,
    store.layerId,
    store.customImage,
    store.customMapMeta,
  ])

  // "?" opens the shortcuts help (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    if (!collabNotice) return
    flash(collabNotice)
    clearCollabNotice()
  }, [collabNotice, clearCollabNotice])

  const snapshotHasWork = (snap: BoardSnapshot) => {
    if (snap.mapId || snap.customImage) return true
    if (snap.squads.length || snap.vehicles.length || (snap.playerPool?.length ?? 0)) return true
    for (const sl of snap.slides ?? []) {
      if (Object.keys(sl.elements).length) return true
    }
    for (const board of Object.values(snap.boards ?? {})) {
      for (const sl of board.slides) {
        if (Object.keys(sl.elements).length) return true
      }
    }
    return false
  }

  const onNewPlan = () => {
    const snap = store.toSnapshot()
    if (snapshotHasWork(snap) && !window.confirm('Start a new blank plan? Current work will be cleared.')) return
    clearLocal()
    useBoardStore.getState().resetToBlank()
    setCurrentPlanId(null)
    setCurrentTitle('Untitled plan')
    setView('board')
    setRoomId(createNewRoom())
    flash('New blank plan')
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
  const buildShareUrl = async (viewOnlyLink: boolean) => {
    const room = roomId
    const base = `${window.location.origin}${window.location.pathname}`
    const viewQ = viewOnlyLink ? '&view=1' : ''
    if (isSupabaseConfigured) {
      try {
        const id = await createShare(store.toSnapshot())
        return `${base}?s=${id}&room=${room}${viewQ}`
      } catch {
        /* fall back to hash link */
      }
    }
    const b64 = encodeToHash(store.toSnapshot()).split('#plan=')[1] ?? ''
    return `${base}?room=${room}${viewQ}#plan=${b64}`
  }

  const onShareEdit = async () => {
    const url = await buildShareUrl(false)
    await copyLink(url, 'Room link copied — host grants edit access in Members')
  }

  const onShareView = async () => {
    const url = await buildShareUrl(true)
    await copyLink(url, 'View-only link copied')
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

  if (!roomId) {
    return (
      <HomeScreen
        onCreateRoom={() => {
          clearLocal()
          useBoardStore.getState().resetToBlank()
          setCurrentPlanId(null)
          setCurrentTitle('Untitled plan')
          const id = createAndEnterRoom()
          setRoomId(id)
        }}
        onJoinRoom={(id) => {
          enterRoom(id)
          setRoomId(id)
        }}
      />
    )
  }

  if (embed) {
    return (
      <div className="h-full flex flex-col bg-bg">
        {readOnly && (
          <div className="shrink-0 px-3 py-1 text-center text-[10px] text-amber-200 bg-amber-500/10 border-b border-amber-500/25">
            {urlViewOnly ? 'View-only link' : 'View access'}
          </div>
        )}
        <div className="shrink-0 px-3 py-1.5 text-xs text-gray-400 border-b border-edge truncate">
          {mapLabel}
          {layerId && map && (
            <span className="text-gray-500">
              {' '}
              · {map.layers.find((l) => l.id === layerId)?.name}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <TacticalBoard readOnly={readOnly} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {readOnly && (
        <div className="shrink-0 px-4 py-2 text-center text-xs text-amber-100/90 bg-amber-500/10 border-b border-amber-500/20">
          {urlViewOnly
            ? 'View-only link — you can watch the plan but not edit it'
            : 'View access — ask the host for edit permission in Members'}
        </div>
      )}
      <header className="app-header flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-12 bg-panel/95 border-b border-edge backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={readOnly ? undefined : onNewPlan}
          disabled={readOnly}
          title={readOnly ? 'CompTactic' : 'New blank plan'}
          className={`brand-mark font-display font-bold text-[15px] tracking-wide select-none shrink-0 ${
            readOnly ? 'cursor-default text-zinc-400' : 'cursor-pointer text-zinc-300 hover:text-white'
          }`}
        >
          Comp<span className="brand-accent text-highlight">Tactic</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Leave this room and return to the home screen?')) {
              leaveToHome()
              setRoomId(null)
            }
          }}
          className="btn btn-ghost text-xs hidden md:inline-flex"
          title="Back to home"
        >
          Home
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={readOnly}
          className="btn max-w-[min(220px,28vw)] truncate disabled:opacity-60 gap-2 !justify-start"
          title="Change map or layer"
        >
          <IconMap className="shrink-0 text-highlight" />
          <span className="truncate">{mapLabel}</span>
        </button>

        <div className="tab-group ml-1 hidden sm:flex">
          <TabBtn active={view === 'board'} onClick={() => setView('board')}>
            Board
          </TabBtn>
          <TabBtn active={view === 'lineup'} onClick={() => setView('lineup')}>
            Line-up
          </TabBtn>
          <TabBtn active={view === 'sheet'} onClick={() => setView('sheet')}>
            Sheet
          </TabBtn>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 overflow-x-auto shrink-0">
          {canEdit && (
            <>
              <button className="btn btn-success" onClick={onSave} title="Save to cloud">
                Save
              </button>
              <button className="btn" onClick={() => setTemplatesOpen(true)} title="Templates &amp; library">
                Templates
              </button>
            </>
          )}
          {view === 'board' && (
            <button className="btn gap-1.5" onClick={() => setBriefingOpen(true)} title="Play slides fullscreen">
              <IconPlay size={14} />
              <span className="hidden md:inline">Briefing</span>
            </button>
          )}
          <ExportMenu
            onPNG={() => exportPNG()}
            onPDF={async () => {
              flash('Exporting PDF…')
              const { exportSlidesPDF } = await import('./lib/exportSlides')
              const ok = await exportSlidesPDF()
              if (!ok) flash('Open the Board with a map first')
            }}
            onAllPNG={async () => {
              flash('Exporting PNG…')
              const { exportSlidesPNG } = await import('./lib/exportSlides')
              const ok = await exportSlidesPNG()
              if (!ok) flash('Open the Board with a map first')
            }}
            onSheetPNG={async () => {
              flash('Exporting tactic sheet…')
              const { exportTacticSheetPNG } = await import('./lib/exportTacticSheet')
              const ok = await exportTacticSheetPNG()
              if (!ok) flash('Open the Board with a map first')
            }}
          />
          {(canEdit || host) && <ShareMenu onEdit={onShareEdit} onView={onShareView} />}
          {isSupabaseConfigured && (
            <button className="btn gap-1.5" onClick={() => setPlansOpen(true)} title="Cloud plans">
              <IconCloud size={15} />
              <span className="hidden lg:inline">Plans</span>
            </button>
          )}
          <button className="btn btn-icon" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts (?)">
            <IconHelp />
          </button>
          <OnlineBar onOpenMembers={() => setMembersOpen(true)} />
          <div className="mx-1 h-6 w-px bg-edge" />
          {user ? (
            <UserMenu email={user.email ?? 'Account'} onSignOut={() => signOut()} />
          ) : (
            <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>Sign in</button>
          )}
        </div>
      </header>

      {view === 'board' && canEdit && <Toolbar />}

      {/* main */}
      {view === 'board' && (
        <div key="view-board" className="flex flex-1 min-h-0 animate-view-in">
          <RosterPanel readOnly={readOnly} />
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 relative">
              <TacticalBoard readOnly={readOnly} />
              {canEdit && <CollabBanner />}
              {canEdit && <LayersPanel />}
            </div>
            <SlidesBar readOnly={readOnly} />
          </div>
          {canEdit && <AssetPalette />}
        </div>
      )}
      {view === 'lineup' && (
        <div key="view-lineup" className="flex-1 min-h-0 flex flex-col overflow-y-auto animate-view-in">
          <LayerInfoPanel />
          <SpawnTimeline />
          <PlayerPool />
          <LineupGrid />
        </div>
      )}
      {view === 'sheet' && (
        <div key="view-sheet" className="flex-1 min-h-0 animate-view-in">
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
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      <RoomMembersModal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        onCopyEditLink={() => {
          void onShareEdit()
        }}
        onCopyViewLink={() => {
          void onShareView()
        }}
      />

      <nav className="sm:hidden shrink-0 flex border-t border-edge bg-panel/95 backdrop-blur-md">
        <MobileTab active={view === 'board'} onClick={() => setView('board')} label="Board" />
        <MobileTab active={view === 'lineup'} onClick={() => setView('lineup')} label="Line-up" />
        <MobileTab active={view === 'sheet'} onClick={() => setView('sheet')} label="Sheet" />
      </nav>

      {toast && <div className="toast">{toast}</div>}
      <span className="site-credit" aria-hidden="true">Z1roNNN</span>
    </div>
  )
}

// Session members — click avatars to open the room members panel.
function OnlineBar({ onOpenMembers }: { onOpenMembers: () => void }) {
  const peers = usePresence((s) => s.peers)
  const name = usePresence((s) => s.name)
  const color = usePresence((s) => s.color)
  const host = usePresence((s) => s.host)
  const collabLiveAt = useBoardStore((s) => s.collabLiveAt)
  const [live, setLive] = useState(false)
  const others = Object.values(peers)
  const total = others.length + 1
  const initial = (n: string) => (n.trim().charAt(0) || '?').toUpperCase()

  useEffect(() => {
    const tick = () => {
      const at = useBoardStore.getState().collabLiveAt
      setLive(at > 0 && Date.now() - at < 4000)
    }
    tick()
    const id = setInterval(tick, 400)
    return () => clearInterval(id)
  }, [collabLiveAt])

  return (
    <div className="relative mr-1 flex items-center gap-1.5">
      {live && (
        <span
          className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
          title="Live sync active"
        />
      )}
      <button
        onClick={onOpenMembers}
        className="flex items-center gap-1 cursor-pointer"
        title={`${total} in session${live ? ' · syncing' : ''} — manage members`}
      >
        <div className="flex items-center -space-x-1.5 avatar-stack">
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
        {host && <span className="hidden xl:inline text-[10px] text-amber-400/90 font-medium ml-0.5">Host</span>}
      </button>
    </div>
  )
}

function ShareMenu({ onEdit, onView }: { onEdit: () => void; onView: () => void }) {
  const [open, setOpen] = useState(false)
  const run = (fn: () => void) => {
    setOpen(false)
    void fn()
  }
  return (
    <div className="relative">
      <button className="btn btn-success gap-1" onClick={() => setOpen((v) => !v)} title="Share links">
        Share
        <IconChevronDown className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-menu w-56">
            <button className="dropdown-item" onClick={() => run(onEdit)}>Room link · host grants edit</button>
            <button className="dropdown-item" onClick={() => run(onView)}>View-only link</button>
          </div>
        </>
      )}
    </div>
  )
}

function ExportMenu({
  onPNG,
  onPDF,
  onAllPNG,
  onSheetPNG,
}: {
  onPNG: () => void
  onPDF: () => void
  onAllPNG: () => void
  onSheetPNG: () => void
}) {
  const [open, setOpen] = useState(false)
  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }
  return (
    <div className="relative">
      <button className="btn gap-1" onClick={() => setOpen((v) => !v)} title="Export">
        Export
        <IconChevronDown className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-menu w-52">
            <button className="dropdown-item" onClick={() => run(onPNG)}>PNG · current slide</button>
            <button className="dropdown-item" onClick={() => run(onPDF)}>PDF · all slides</button>
            <button className="dropdown-item" onClick={() => run(onAllPNG)}>PNG · all slides</button>
            <button className="dropdown-item" onClick={() => run(onSheetPNG)}>PNG · tactic sheet</button>
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
    <button type="button" onClick={onClick} className={`tab-btn ${active ? 'tab-btn-active' : ''}`}>
      {children}
    </button>
  )
}

function MobileTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
        active ? 'text-highlight border-t-2 border-highlight bg-highlight/5' : 'text-zinc-500 border-t-2 border-transparent'
      }`}
    >
      {label}
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
        className="h-8 w-8 rounded-full bg-highlight text-white text-sm font-semibold grid place-items-center cursor-pointer hover:bg-blue-500 transition-colors"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-menu w-56">
            <div className="dropdown-label truncate">{email}</div>
            <button
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
              className="dropdown-item"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
