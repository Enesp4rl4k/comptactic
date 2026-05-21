import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import { loadTemplates, saveStamp, saveRoster, deleteTemplate, type Template } from '../lib/templates'

export default function TemplatesModal({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
  const [list, setList] = useState<Template[]>(() => loadTemplates())
  const [tab, setTab] = useState<'stamp' | 'roster'>('stamp')

  const elements = useBoardStore((s) => s.elements)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const squads = useBoardStore((s) => s.squads)
  const vehicles = useBoardStore((s) => s.vehicles)
  const playerPool = useBoardStore((s) => s.playerPool)
  const addStampElements = useBoardStore((s) => s.addStampElements)
  const applyRoster = useBoardStore((s) => s.applyRoster)

  const shown = list.filter((t) => t.kind === tab)

  const onSaveStamp = () => {
    const els = selectedIds.map((id) => elements[id]).filter(Boolean)
    if (!els.length) {
      flash('Select elements on the board first')
      return
    }
    const name = window.prompt(`Name this stamp (${els.length} elements):`, 'My stamp')
    if (!name) return
    setList(saveStamp(name, els as never))
    flash('Stamp saved')
  }

  const onSaveRoster = () => {
    if (!squads.length && !vehicles.length && !playerPool.length) {
      flash('Build a roster first (squads / vehicles)')
      return
    }
    const name = window.prompt('Name this roster setup:', 'My roster')
    if (!name) return
    setList(saveRoster(name, squads, vehicles, playerPool))
    flash('Roster saved')
  }

  const apply = (t: Template) => {
    if (t.kind === 'stamp') {
      addStampElements(t.elements as never)
      flash(`Placed “${t.name}”`)
      onClose()
    } else {
      if (confirm(`Replace current squads, vehicles and player pool with “${t.name}”?`)) {
        applyRoster(t.squads, t.vehicles, t.playerPool)
        flash(`Loaded roster “${t.name}”`)
        onClose()
      }
    }
  }

  const tabBtn = (id: 'stamp' | 'roster', label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`px-3 h-7 rounded-md text-sm font-medium cursor-pointer ${
        tab === id ? 'bg-accent text-white' : 'text-gray-400 hover:text-white hover:bg-edge/60'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[560px] max-w-[94vw] max-h-[86vh] bg-panel border border-edge rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <h2 className="font-display font-semibold tracking-wide">Templates &amp; Library</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white text-xl leading-none cursor-pointer">×</button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-edge">
          <div className="flex items-center rounded-lg bg-panel2 border border-edge p-0.5">
            {tabBtn('stamp', 'Mark stamps')}
            {tabBtn('roster', 'Rosters')}
          </div>
          <button
            className="btn btn-primary ml-auto h-7 text-xs"
            onClick={tab === 'stamp' ? onSaveStamp : onSaveRoster}
          >
            {tab === 'stamp' ? '+ Save selection as stamp' : '+ Save current roster'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {shown.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-10">
              {tab === 'stamp'
                ? 'No stamps yet. Select marks on the board, then “Save selection as stamp”.'
                : 'No roster setups yet. Build squads/vehicles, then “Save current roster”.'}
            </div>
          )}
          <div className="grid gap-2">
            {shown.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-md bg-panel2 border border-edge">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {t.kind === 'stamp'
                      ? `${t.elements.length} elements`
                      : `${t.squads.length} squads · ${t.vehicles.length} vehicles · ${t.playerPool.length} in pool`}
                    {' · '}
                    {new Date(t.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn btn-primary h-7 text-xs" onClick={() => apply(t)}>
                  {t.kind === 'stamp' ? 'Place' : 'Load'}
                </button>
                <button
                  className="btn h-7 text-xs"
                  onClick={() => { if (confirm('Delete this template?')) setList(deleteTemplate(t.id)) }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
