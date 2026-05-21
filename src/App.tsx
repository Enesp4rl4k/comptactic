import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import AssetPalette from './components/AssetPalette'
import RosterPanel from './components/RosterPanel'
import MapPicker from './components/MapPicker'
import TacticalBoard from './components/TacticalBoard'
import SlidesBar from './components/SlidesBar'
import LineupGrid from './components/LineupGrid'
import TacticSheet from './components/TacticSheet'
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
  const [toast, setToast] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'lineup' | 'sheet'>('board')
  const store = useBoardStore()
  const map = store.mapId ? MAP_BY_ID[store.mapId] : null

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
  }, [store.elements, store.slides, store.activeSlideId, store.squads, store.vehicles, store.mapId, store.layerId])

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
      <header className="flex items-center gap-3 px-4 h-12 bg-[#161a22] border-b border-edge shrink-0">
        <div className="font-bold tracking-tight text-blue-400">
          Comp<span className="text-white">Tactic</span>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="px-3 h-8 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
        >
          🗺️ {map ? map.name : 'Select Map'}
        </button>

        <div className="ml-2 flex items-center rounded bg-panel2 border border-edge p-0.5">
          <TabBtn active={view === 'board'} onClick={() => setView('board')}>
            🗺️ Board
          </TabBtn>
          <TabBtn active={view === 'lineup'} onClick={() => setView('lineup')}>
            📋 Line-up
          </TabBtn>
          <TabBtn active={view === 'sheet'} onClick={() => setView('sheet')}>
            🧩 Tactic Sheet
          </TabBtn>
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <HeaderBtn onClick={() => downloadJSON(store.toSnapshot())}>💾 Save</HeaderBtn>
          <HeaderBtn onClick={onImport}>📂 Load</HeaderBtn>
          <HeaderBtn onClick={() => exportPNG()}>🖼️ PNG</HeaderBtn>
          <HeaderBtn onClick={onShare} primary>
            🔗 Share
          </HeaderBtn>
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
        <div className="flex-1 min-h-0">
          <LineupGrid />
        </div>
      )}
      {view === 'sheet' && (
        <div className="flex-1 min-h-0">
          <TacticSheet />
        </div>
      )}

      {pickerOpen && <MapPicker onClose={() => setPickerOpen(false)} />}

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
      className={`px-3 h-7 rounded text-sm font-medium ${
        active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function HeaderBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded text-sm font-medium border ${
        primary
          ? 'bg-green-600 hover:bg-green-500 border-green-500 text-white'
          : 'bg-panel2 hover:bg-edge border-edge text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
