import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import AssetPalette from './components/AssetPalette'
import RosterPanel from './components/RosterPanel'
import MapPicker from './components/MapPicker'
import TacticalBoard from './components/TacticalBoard'
import SlidesBar from './components/SlidesBar'
import LineupGrid from './components/LineupGrid'
import LayerInfoPanel from './components/LayerInfoPanel'
import TacticSheet from './components/TacticSheet'
import AuthModal from './components/AuthModal'
import PlansModal from './components/PlansModal'
import { useAuth, signOut } from './lib/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import type { BoardSnapshot } from './types'
import { useBoardStore } from './store/useBoardStore'
import { MAP_BY_ID } from './data/maps'
import {
  saveLocal,
  loadLocal,
  downloadJSON,
  importJSON,
  encodeToHash,
  decodeFromHash,
  exportPNG,
} from './lib/persist'

export default function App() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState('Untitled plan')
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'lineup' | 'sheet'>('board')
  const store = useBoardStore()
  const { user } = useAuth()
  const map = store.mapId ? MAP_BY_ID[store.mapId] : null
  const mapLabel = store.customImage ? store.customImageName || 'Custom image' : map ? map.name : 'Select Map'

  // load shared plan from URL, else autosave
  useEffect(() => {
    const fromHash = decodeFromHash()
    if (fromHash) {
      store.loadSnapshot(fromHash)
      return
    }
    const auto = loadLocal()
    if (auto) store.loadSnapshot(auto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => saveLocal(store.toSnapshot()), 600)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.elements, store.slides, store.activeSlideId, store.squads, store.vehicles, store.mapId, store.layerId, store.customImage])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const onShare = async () => {
    const url = encodeToHash(store.toSnapshot())
    try {
      await navigator.clipboard.writeText(url)
      history.replaceState(null, '', url)
      flash('Share link copied to clipboard')
    } catch {
      history.replaceState(null, '', url)
      flash('Link written to the address bar')
    }
  }

  const onImport = async () => {
    const snap = await importJSON()
    if (snap) {
      store.loadSnapshot(snap)
      flash('Plan loaded')
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
          <button className="btn" onClick={() => downloadJSON(store.toSnapshot())}>Save</button>
          <button className="btn" onClick={onImport}>Load</button>
          <button className="btn" onClick={() => exportPNG()}>PNG</button>
          <button className="btn btn-success" onClick={onShare}>Share</button>
          {isSupabaseConfigured && (
            <button className="btn" onClick={() => setPlansOpen(true)}>☁ Plans</button>
          )}
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
            <div className="flex-1 min-h-0">
              <TacticalBoard />
            </div>
            <SlidesBar />
          </div>
          <AssetPalette />
        </div>
      )}
      {view === 'lineup' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <LayerInfoPanel />
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

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
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
